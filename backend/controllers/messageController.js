const messageModel = require("../models/messageModel");
const orderModel = require("../models/orderModel");

const pedidoIdValido = (pedidoId) => {
    const id = Number(pedidoId);

    return (
        Number.isInteger(id) &&
        id > 0
    );
};

const responderErrorServidor = (
    res,
    mensaje,
    error
) => {
    console.error(mensaje, error);

    return res.status(500).json({
        message: mensaje
    });
};

const verificarAccesoPedido = (
    req,
    res,
    callback
) => {
    const pedidoId = req.params.pedidoId;
    const usuarioId = Number(req.user.id);
    const rol = req.user.rol;

    if (!pedidoIdValido(pedidoId)) {
        res.status(400).json({
            message: "ID de pedido no válido"
        });

        return;
    }

    orderModel.getOrderById(
        pedidoId,
        (err, pedidos) => {
            if (err) {
                responderErrorServidor(
                    res,
                    "Error al consultar pedido",
                    err
                );

                return;
            }

            if (!pedidos.length) {
                res.status(404).json({
                    message: "Pedido no encontrado"
                });

                return;
            }

            const pedido = pedidos[0];

            const esAdmin =
                rol === "admin";

            const esClienteDelPedido =
                rol === "cliente" &&
                Number(pedido.cliente_id) === usuarioId;

            const esRepartidorDelPedido =
                rol === "repartidor" &&
                Number(pedido.repartidor_id) === usuarioId;

            if (
                !esAdmin &&
                !esClienteDelPedido &&
                !esRepartidorDelPedido
            ) {
                res.status(403).json({
                    message:
                        "No tiene permiso para acceder al chat de este pedido"
                });

                return;
            }

            callback(pedido);
        }
    );
};

const createMessage = (req, res) => {
    const usuarioId = Number(req.user.id);
    const pedidoId = req.params.pedidoId;

    const {
        mensaje
    } = req.body || {};

    if (
        typeof mensaje !== "string" ||
        !mensaje.trim()
    ) {
        return res.status(400).json({
            message: "El mensaje es obligatorio"
        });
    }

    const mensajeLimpio = mensaje.trim();

    if (mensajeLimpio.length > 1000) {
        return res.status(400).json({
            message:
                "El mensaje no puede superar los 1000 caracteres"
        });
    }

    verificarAccesoPedido(
        req,
        res,
        () => {
            messageModel.createMessage(
                pedidoId,
                usuarioId,
                mensajeLimpio,
                (err, result) => {
                    if (err) {
                        return responderErrorServidor(
                            res,
                            "Error al enviar mensaje",
                            err
                        );
                    }

                    const nuevoMensaje = {
                        id: result.insertId,
                        pedido_id: Number(pedidoId),
                        usuario_id: usuarioId,
                        mensaje: mensajeLimpio,
                        usuario_nombre:
                            req.user.nombre || null,
                        usuario_rol:
                            req.user.rol,
                        fecha:
                            new Date().toISOString()
                    };

                    const io =
                        req.app.get("io");

                    if (io) {
                        io.to(
                            `pedido_${pedidoId}`
                        ).emit(
                            "nuevoMensaje",
                            nuevoMensaje
                        );
                    }

                    return res.status(201).json({
                        message:
                            "Mensaje enviado correctamente",
                        mensaje_id:
                            result.insertId
                    });
                }
            );
        }
    );
};

const getMessagesByOrder = (
    req,
    res
) => {
    const pedidoId =
        req.params.pedidoId;

    verificarAccesoPedido(
        req,
        res,
        () => {
            messageModel.getMessagesByOrder(
                pedidoId,
                (err, results) => {
                    if (err) {
                        return responderErrorServidor(
                            res,
                            "Error al obtener mensajes",
                            err
                        );
                    }

                    return res.json({
                        message:
                            "Mensajes del pedido",
                        mensajes:
                            results
                    });
                }
            );
        }
    );
};

module.exports = {
    createMessage,
    getMessagesByOrder
};
