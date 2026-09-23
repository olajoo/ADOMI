const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const userModel = require("../models/userModel");

const EMAIL_REGEX =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const limpiarTexto = (valor) =>
    typeof valor === "string"
        ? valor.trim()
        : "";

const normalizarCorreo = (valor) =>
    limpiarTexto(valor).toLowerCase();

const validarPassword = (password) => {
    if (typeof password !== "string") {
        return false;
    }

    return (
        password.length >= 8 &&
        password.length <= 72
    );
};

// REGISTRO PÚBLICO
const register = async (req, res) => {
    const nombre =
        limpiarTexto(req.body?.nombre);

    const correo =
        normalizarCorreo(req.body?.correo);

    const password =
        req.body?.password;

    if (!nombre || !correo || !password) {
        return res.status(400).json({
            message:
                "Nombre, correo y contraseña son obligatorios"
        });
    }

    if (
        nombre.length < 2 ||
        nombre.length > 100
    ) {
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

    /*
     * IMPORTANTE:
     * El registro público SIEMPRE crea clientes.
     * El rol enviado por el navegador se ignora.
     *
     * Los repartidores deben ser creados desde
     * el panel protegido del administrador.
     */
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
                    if (
                        err.code ===
                        "ER_DUP_ENTRY"
                    ) {
                        return res
                            .status(409)
                            .json({
                                message:
                                    "El correo ya está registrado"
                            });
                    }

                    console.error(
                        "Error al registrar usuario:",
                        err
                    );

                    return res
                        .status(500)
                        .json({
                            message:
                                "Error al registrar usuario"
                        });
                }

                return res
                    .status(201)
                    .json({
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

// LOGIN
const login = (req, res) => {
    const correo =
        normalizarCorreo(req.body?.correo);

    const password =
        req.body?.password;

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

            /*
             * Usamos el mismo mensaje si el correo
             * no existe o la contraseña es incorrecta.
             * Así no revelamos qué correos están
             * registrados en ADOMI.
             */
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
                    return res
                        .status(401)
                        .json({
                            message:
                                "Correo o contraseña incorrectos"
                        });
                }

                if (
                    user.estado === "inactivo"
                ) {
                    return res
                        .status(403)
                        .json({
                            message:
                                "Usuario inactivo. Contacte al administrador."
                        });
                }

                if (!process.env.JWT_SECRET) {
                    console.error(
                        "JWT_SECRET no está configurado"
                    );

                    return res
                        .status(500)
                        .json({
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

                return res
                    .status(200)
                    .json({
                        message:
                            "Login exitoso",

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

module.exports = {
    register,
    login
};
