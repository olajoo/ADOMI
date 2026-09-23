const bcrypt = require("bcrypt");

const adminModel = require("../models/adminModel");
const orderModel = require("../models/orderModel");
const userModel = require("../models/userModel");

const getAllUsers = (req, res) => {
    adminModel.getAllUsers((err, results) => {
        if (err) {
            return res.status(500).json({
                message: "Error al obtener usuarios",
                error: err
            });
        }

        res.json({
            message: "Usuarios obtenidos correctamente",
            usuarios: results
        });
    });
};

const getClients = (req, res) => {
    adminModel.getUsersByRole("cliente", (err, results) => {
        if (err) {
            return res.status(500).json({
                message: "Error al obtener clientes",
                error: err
            });
        }

        res.json({
            message: "Clientes obtenidos correctamente",
            clientes: results
        });
    });
};

const getDeliveryUsers = (req, res) => {
    adminModel.getUsersByRole("repartidor", (err, results) => {
        if (err) {
            return res.status(500).json({
                message: "Error al obtener repartidores",
                error: err
            });
        }

        res.json({
            message: "Repartidores obtenidos correctamente",
            repartidores: results
        });
    });
};

const updateUserStatus = (req, res) => {
    const userId = req.params.id;
    const { estado } = req.body || {};

    const estadosPermitidos = ["activo", "inactivo"];

    if (!estadosPermitidos.includes(estado)) {
        return res.status(400).json({
            message: "Estado no válido. Use activo o inactivo"
        });
    }

    adminModel.updateUserStatus(userId, estado, (err, result) => {
        if (err) {
            return res.status(500).json({
                message: "Error al actualizar estado del usuario",
                error: err
            });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: "Usuario no encontrado"
            });
        }

        res.json({
            message: "Estado del usuario actualizado correctamente"
        });
    });
};

const getDashboardStats = (req, res) => {
    adminModel.getDashboardStats((err, results) => {
        if (err) {
            return res.status(500).json({
                message: "Error al obtener estadísticas",
                error: err
            });
        }

        res.json({
            message: "Estadísticas obtenidas correctamente",
            stats: results[0]
        });
    });
};

// ======================================================
// RESOLVER INCIDENCIA DE PEDIDO
// ======================================================

const resolveOrderIncident = (req, res) => {

    const pedidoId = Number(req.params.id);

    const {
        resolucion
    } = req.body || {};


    // Validar ID

    if (
        !Number.isInteger(pedidoId) ||
        pedidoId <= 0
    ) {
        return res.status(400).json({
            message: "ID de pedido no válido"
        });
    }


    // Validar resolución

    if (
        typeof resolucion !== "string" ||
        !resolucion.trim()
    ) {
        return res.status(400).json({
            message: "Debe escribir la resolución de la incidencia"
        });
    }


    const resolucionLimpia =
        resolucion.trim();


    if (resolucionLimpia.length < 5) {
        return res.status(400).json({
            message: "La resolución debe contener al menos 5 caracteres"
        });
    }


    if (resolucionLimpia.length > 500) {
        return res.status(400).json({
            message: "La resolución no puede superar los 500 caracteres"
        });
    }


    orderModel.resolveIncident(
        pedidoId,
        resolucionLimpia,
        (err, result) => {

            if (err) {

                console.error(
                    "Error al resolver incidencia:",
                    err
                );

                return res.status(500).json({
                    message: "Error al resolver la incidencia"
                });
            }


            if (result.affectedRows === 0) {

                return res.status(409).json({
                    message:
                        "La incidencia no existe, ya fue resuelta o el pedido no tiene un problema reportado"
                });
            }


            return res.json({
                message:
                    "Incidencia resuelta correctamente",
                pedido_id: pedidoId
            });
        }
    );
};

// ======================================================
// CORREGIR PEDIDO CANCELADO - ADMIN
// ======================================================

const correctCancelledOrder = (req, res) => {
    const pedidoId = Number(req.params.id);

    const {
        lugar_compra,
        descripcion,
        direccion,
        telefono_contacto,
        total
    } = req.body || {};

    // Validar ID
    if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
        return res.status(400).json({
            message: "ID de pedido no válido"
        });
    }

    // Validar campos de texto
    if (
        typeof lugar_compra !== "string" ||
        typeof descripcion !== "string" ||
        typeof direccion !== "string" ||
        typeof telefono_contacto !== "string"
    ) {
        return res.status(400).json({
            message: "Los datos del pedido no son válidos"
        });
    }

    const lugarCompraLimpio = lugar_compra.trim();
    const descripcionLimpia = descripcion.trim();
    const direccionLimpia = direccion.trim();

    // Limpiar teléfono
    const telefonoLimpio = telefono_contacto.replace(/\D/g, "");

    // Validar campos obligatorios
    if (
        !lugarCompraLimpio ||
        !descripcionLimpia ||
        !direccionLimpia
    ) {
        return res.status(400).json({
            message: "Lugar de compra, descripción y dirección son obligatorios"
        });
    }

    // Validar lugar de compra
    if (
        lugarCompraLimpio.length < 2 ||
        lugarCompraLimpio.length > 150
    ) {
        return res.status(400).json({
            message: "El lugar de compra debe tener entre 2 y 150 caracteres"
        });
    }

    // Validar teléfono de Guatemala
    if (telefonoLimpio.length !== 8) {
        return res.status(400).json({
            message: "El teléfono debe contener exactamente 8 dígitos"
        });
    }

    const telefonoFormateado =
        `${telefonoLimpio.slice(0, 4)}-${telefonoLimpio.slice(4)}`;

    // Validar total
    const totalNumero = Number(total);

    if (
        !Number.isFinite(totalNumero) ||
        totalNumero <= 0 ||
        totalNumero > 99999999.99
    ) {
        return res.status(400).json({
            message: "El total estimado debe ser mayor a Q 0.00"
        });
    }

    orderModel.correctCancelledOrder(
        pedidoId,
        lugarCompraLimpio,
        descripcionLimpia,
        direccionLimpia,
        telefonoFormateado,
        totalNumero,
        (err, result) => {
            if (err) {
                console.error(
                    "Error al corregir pedido cancelado:",
                    err
                );

                return res.status(500).json({
                    message: "Error al corregir el pedido"
                });
            }

            if (result.affectedRows === 0) {
                return res.status(409).json({
                    message:
                        "El pedido no existe o ya no se encuentra cancelado"
                });
            }

            return res.json({
                message: "Pedido corregido correctamente",
                pedido_id: pedidoId
            });
        }
    );
};

const createAdminUser = async (req, res) => {
    const nombre =
        typeof req.body?.nombre === "string"
            ? req.body.nombre.trim()
            : "";

    const correo =
        typeof req.body?.correo === "string"
            ? req.body.correo.trim().toLowerCase()
            : "";

    const password = req.body?.password;

    const emailRegex =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
        !emailRegex.test(correo)
    ) {
        return res.status(400).json({
            message:
                "Ingrese un correo electrónico válido"
        });
    }

    if (
        typeof password !== "string" ||
        password.length < 8 ||
        password.length > 72
    ) {
        return res.status(400).json({
            message:
                "La contraseña debe tener entre 8 y 72 caracteres"
        });
    }

    try {
        const hashedPassword =
            await bcrypt.hash(password, 10);

        userModel.createUser(
            nombre,
            correo,
            hashedPassword,
            "admin",
            (err, result) => {
                if (err) {
                    if (err.code === "ER_DUP_ENTRY") {
                        return res.status(409).json({
                            message:
                                "El correo ya está registrado"
                        });
                    }

                    console.error(
                        "Error creando administrador:",
                        err
                    );

                    return res.status(500).json({
                        message:
                            "Error al crear administrador"
                    });
                }

                return res.status(201).json({
                    message:
                        "Administrador creado correctamente",
                    administrador: {
                        id: result.insertId,
                        nombre,
                        correo,
                        rol: "admin"
                    }
                });
            }
        );
    } catch (error) {
        console.error(
            "Error procesando administrador:",
            error
        );

        return res.status(500).json({
            message:
                "Error al crear administrador"
        });
    }
};

const createDeliveryUser = async (req, res) => {
    const nombre =
        typeof req.body?.nombre === "string"
            ? req.body.nombre.trim()
            : "";

    const correo =
        typeof req.body?.correo === "string"
            ? req.body.correo.trim().toLowerCase()
            : "";

    const password = req.body?.password;

    const emailRegex =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
        !emailRegex.test(correo)
    ) {
        return res.status(400).json({
            message:
                "Ingrese un correo electrónico válido"
        });
    }

    if (
        typeof password !== "string" ||
        password.length < 8 ||
        password.length > 72
    ) {
        return res.status(400).json({
            message:
                "La contraseña debe tener entre 8 y 72 caracteres"
        });
    }

    try {
        const hashedPassword =
            await bcrypt.hash(password, 10);

        userModel.createUser(
            nombre,
            correo,
            hashedPassword,
            "repartidor",
            (err, result) => {
                if (err) {
                    if (err.code === "ER_DUP_ENTRY") {
                        return res.status(409).json({
                            message:
                                "El correo ya está registrado"
                        });
                    }

                    console.error(
                        "Error creando repartidor:",
                        err
                    );

                    return res.status(500).json({
                        message:
                            "Error al crear repartidor"
                    });
                }

                return res.status(201).json({
                    message:
                        "Repartidor creado correctamente",
                    repartidor: {
                        id: result.insertId,
                        nombre,
                        correo,
                        rol: "repartidor"
                    }
                });
            }
        );
    } catch (error) {
        console.error(
            "Error procesando repartidor:",
            error
        );

        return res.status(500).json({
            message:
                "Error al crear repartidor"
        });
    }
};

module.exports = {
    getAllUsers,
    getClients,
    getDeliveryUsers,
    updateUserStatus,
    getDashboardStats,
    resolveOrderIncident,
    correctCancelledOrder,
    createAdminUser,
    createDeliveryUser,
};