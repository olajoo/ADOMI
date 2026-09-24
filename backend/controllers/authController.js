const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const userModel = require("../models/userModel");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const limpiarTexto = (valor) =>
    typeof valor === "string" ? valor.trim() : "";

const normalizarCorreo = (valor) =>
    limpiarTexto(valor).toLowerCase();

const validarPassword = (password) =>
    typeof password === "string" &&
    password.length >= 8 &&
    password.length <= 72;

const RESPUESTA_RECUPERACION = {
    message:
        "Si el correo está registrado, recibirás un enlace para restablecer tu contraseña."
};

const MAILERSEND_FROM_EMAIL =
    "no-reply@test-69oxl5e50wkl785k.mlsender.net";

const enviarCorreoRecuperacion = async ({
    correo,
    nombre,
    resetUrl
}) => {
    if (!process.env.MAILERSEND_API_TOKEN) {
        throw new Error(
            "MAILERSEND_API_TOKEN no está configurada"
        );
    }

    const response = await fetch(
        "https://api.mailersend.com/v1/email",
        {
            method: "POST",
            headers: {
                Authorization:
                    `Bearer ${process.env.MAILERSEND_API_TOKEN}`,
                "Content-Type": "application/json",
                Accept: "application/json"
            },
            body: JSON.stringify({
                from: {
                    email: MAILERSEND_FROM_EMAIL,
                    name: "ADOMI"
                },
                to: [
                    {
                        email: correo,
                        name: nombre
                    }
                ],
                subject:
                    "Restablece tu contraseña de ADOMI",
                text:
                    `Hola ${nombre}.\n\n` +
                    `Recibimos una solicitud para restablecer tu contraseña de ADOMI.\n\n` +
                    `Abre este enlace dentro de los próximos 15 minutos:\n${resetUrl}\n\n` +
                    `Si no solicitaste este cambio, puedes ignorar este correo.`,
                html:
                    `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;line-height:1.6">` +
                    `<h2>Recuperación de contraseña</h2>` +
                    `<p>Hola ${nombre}.</p>` +
                    `<p>Recibimos una solicitud para restablecer tu contraseña de ADOMI.</p>` +
                    `<p>El enlace estará disponible durante <strong>15 minutos</strong>.</p>` +
                    `<p>` +
                    `<a href="${resetUrl}" ` +
                    `style="display:inline-block;padding:12px 18px;background:#212529;color:#ffffff;text-decoration:none;border-radius:8px">` +
                    `Restablecer contraseña` +
                    `</a>` +
                    `</p>` +
                    `<p style="font-size:13px;color:#6c757d">` +
                    `Si no solicitaste este cambio, puedes ignorar este correo.` +
                    `</p>` +
                    `</div>`
            })
        }
    );

    if (!response.ok) {
        let detalle = "";

        try {
            detalle = await response.text();
        } catch (error) {
            detalle = "No se pudo leer la respuesta de MailerSend";
        }

        throw new Error(
            `MailerSend respondió ${response.status}: ${detalle}`
        );
    }
};

const register = async (req, res) => {
    const nombre = limpiarTexto(req.body?.nombre);
    const correo = normalizarCorreo(req.body?.correo);
    const password = req.body?.password;

    if (!nombre || !correo || !password) {
        return res.status(400).json({
            message:
                "Nombre, correo y contraseña son obligatorios"
        });
    }

    if (nombre.length < 2 || nombre.length > 100) {
        return res.status(400).json({
            message:
                "El nombre debe tener entre 2 y 100 caracteres"
        });
    }

    if (
        correo.length > 150 ||
        !EMAIL_REGEX.test(correo)
    ) {
        return res.status(400).json({
            message:
                "Ingrese un correo electrónico válido"
        });
    }

    if (!validarPassword(password)) {
        return res.status(400).json({
            message:
                "La contraseña debe tener entre 8 y 72 caracteres"
        });
    }

    const rol = "cliente";

    try {
        const hashedPassword =
            await bcrypt.hash(password, 10);

        userModel.createUser(
            nombre,
            correo,
            hashedPassword,
            rol,
            (err) => {
                if (err) {
                    if (err.code === "ER_DUP_ENTRY") {
                        return res.status(409).json({
                            message:
                                "El correo ya está registrado"
                        });
                    }

                    console.error(
                        "Error al registrar usuario:",
                        err
                    );

                    return res.status(500).json({
                        message:
                            "Error al registrar usuario"
                    });
                }

                return res.status(201).json({
                    message:
                        "Usuario registrado correctamente"
                });
            }
        );
    } catch (error) {
        console.error(
            "Error procesando registro:",
            error
        );

        return res.status(500).json({
            message: "Error servidor"
        });
    }
};

const login = (req, res) => {
    const correo = normalizarCorreo(req.body?.correo);
    const password = req.body?.password;

    if (!correo || !password) {
        return res.status(400).json({
            message:
                "Correo y contraseña son obligatorios"
        });
    }

    if (
        correo.length > 150 ||
        !EMAIL_REGEX.test(correo) ||
        typeof password !== "string" ||
        password.length > 72
    ) {
        return res.status(401).json({
            message:
                "Correo o contraseña incorrectos"
        });
    }

    userModel.findUserByEmail(
        correo,
        async (err, results) => {
            if (err) {
                console.error(
                    "Error consultando usuario:",
                    err
                );

                return res.status(500).json({
                    message: "Error servidor"
                });
            }

            if (results.length === 0) {
                return res.status(401).json({
                    message:
                        "Correo o contraseña incorrectos"
                });
            }

            const user = results[0];

            try {
                const validPassword =
                    await bcrypt.compare(
                        password,
                        user.password
                    );

                if (!validPassword) {
                    return res.status(401).json({
                        message:
                            "Correo o contraseña incorrectos"
                    });
                }

                if (user.estado === "inactivo") {
                    return res.status(403).json({
                        message:
                            "Usuario inactivo. Contacte al administrador."
                    });
                }

                if (!process.env.JWT_SECRET) {
                    console.error(
                        "JWT_SECRET no está configurado"
                    );

                    return res.status(500).json({
                        message:
                            "Error de configuración del servidor"
                    });
                }

                const token = jwt.sign(
                    {
                        id: user.id,
                        rol: user.rol
                    },
                    process.env.JWT_SECRET,
                    {
                        expiresIn: "8h"
                    }
                );

                return res.status(200).json({
                    message: "Login exitoso",
                    token,
                    user: {
                        id: user.id,
                        nombre: user.nombre,
                        correo: user.correo,
                        rol: user.rol,
                        estado: user.estado
                    }
                });
            } catch (error) {
                console.error(
                    "Error validando credenciales:",
                    error
                );

                return res.status(500).json({
                    message: "Error servidor"
                });
            }
        }
    );
};

const forgotPassword = (req, res) => {
    const correo =
        normalizarCorreo(req.body?.correo);

    if (
        !correo ||
        correo.length > 150 ||
        !EMAIL_REGEX.test(correo)
    ) {
        return res
            .status(200)
            .json(RESPUESTA_RECUPERACION);
    }

    userModel.findUserByEmail(
        correo,
        async (err, results) => {
            if (err) {
                console.error(
                    "Error consultando usuario para recuperación:",
                    err
                );

                return res.status(500).json({
                    message:
                        "No fue posible procesar la solicitud"
                });
            }

            if (
                results.length === 0 ||
                results[0].estado === "inactivo"
            ) {
                return res
                    .status(200)
                    .json(RESPUESTA_RECUPERACION);
            }

            const user = results[0];

            const token =
                crypto.randomBytes(32).toString("hex");

            const tokenHash = crypto
                .createHash("sha256")
                .update(token)
                .digest("hex");

            const expires =
                new Date(
                    Date.now() + 15 * 60 * 1000
                );

            userModel.saveResetPasswordToken(
                user.id,
                tokenHash,
                expires,
                async (saveErr) => {
                    if (saveErr) {
                        console.error(
                            "Error guardando token de recuperación:",
                            saveErr
                        );

                        return res.status(500).json({
                            message:
                                "No fue posible procesar la solicitud"
                        });
                    }

                    try {
                        const frontendUrl = (
                            process.env.FRONTEND_URL ||
                            "http://localhost:5173"
                        ).replace(/\/+$/, "");

                        const resetUrl =
                            `${frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;

                        await enviarCorreoRecuperacion({
                            correo: user.correo,
                            nombre: user.nombre,
                            resetUrl
                        });

                        return res
                            .status(200)
                            .json(
                                RESPUESTA_RECUPERACION
                            );
                    } catch (mailError) {
                        console.error(
                            "Error enviando correo de recuperación:",
                            mailError
                        );

                        userModel.clearResetPasswordToken(
                            user.id,
                            () => {}
                        );

                        return res.status(500).json({
                            message:
                                "No fue posible enviar el correo de recuperación"
                        });
                    }
                }
            );
        }
    );
};

const resetPassword = (req, res) => {
    const token =
        limpiarTexto(req.body?.token);

    const password =
        req.body?.password;

    if (
        !token ||
        !validarPassword(password)
    ) {
        return res.status(400).json({
            message:
                "Token y contraseña válida son obligatorios. La contraseña debe tener entre 8 y 72 caracteres."
        });
    }

    const tokenHash = crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");

    userModel.findUserByValidResetToken(
        tokenHash,
        async (err, results) => {
            if (err) {
                console.error(
                    "Error validando token de recuperación:",
                    err
                );

                return res.status(500).json({
                    message: "Error servidor"
                });
            }

            if (results.length === 0) {
                return res.status(400).json({
                    message:
                        "El enlace de recuperación es inválido o ha expirado"
                });
            }

            const user = results[0];

            try {
                const hashedPassword =
                    await bcrypt.hash(
                        password,
                        10
                    );

                userModel
                    .updatePasswordAndClearResetToken(
                        user.id,
                        hashedPassword,
                        (updateErr) => {
                            if (updateErr) {
                                console.error(
                                    "Error actualizando contraseña:",
                                    updateErr
                                );

                                return res
                                    .status(500)
                                    .json({
                                        message:
                                            "No fue posible actualizar la contraseña"
                                    });
                            }

                            return res
                                .status(200)
                                .json({
                                    message:
                                        "Contraseña actualizada correctamente"
                                });
                        }
                    );
            } catch (error) {
                console.error(
                    "Error procesando nueva contraseña:",
                    error
                );

                return res.status(500).json({
                    message: "Error servidor"
                });
            }
        }
    );
};

module.exports = {
    register,
    login,
    forgotPassword,
    resetPassword
};