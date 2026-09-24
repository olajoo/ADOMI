const orderModel = require("../models/orderModel");
const historyModel = require("../models/historyModel");


// ======================================================
// FUNCIONES AUXILIARES
// ======================================================

const emitPedidoActualizado = (req, pedidoId, data = {}) => {
    const io = req.app.get("io");

    if (!io) {
        return;
    }

    io.to(`pedido_${pedidoId}`).emit(
        "pedidoActualizado",
        {
            id: Number(pedidoId),
            ...data
        }
    );
};


const pedidoIdValido = (id) => {
    const numero = Number(id);

    return (
        Number.isInteger(numero) &&
        numero > 0
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


// ======================================================
// CREAR PEDIDO
// CLIENTE
// ======================================================

const createOrder = (req, res) => {
    const clienteId = req.user.id;

    const {
        tipo_servicio,
        lugar_compra,
        descripcion,
        direccion,
        telefono_contacto,
        total,
        cliente_latitud,
        cliente_longitud
    } = req.body || {};


    // --------------------------------------------------
    // VALIDAR CAMPOS GENERALES
    // --------------------------------------------------

    if (
        !tipo_servicio ||
        typeof tipo_servicio !== "string" ||
        !lugar_compra ||
        typeof lugar_compra !== "string" ||
        !lugar_compra.trim() ||
        !descripcion ||
        typeof descripcion !== "string" ||
        !descripcion.trim() ||
        !direccion ||
        typeof direccion !== "string" ||
        !direccion.trim() ||
        !telefono_contacto ||
        typeof telefono_contacto !== "string" ||
        !telefono_contacto.trim() ||
        total === undefined ||
        total === null ||
        total === ""
    ) {
        return res.status(400).json({
            message: "Todos los campos son obligatorios"
        });
    }


    // --------------------------------------------------
    // VALIDAR LUGAR DE COMPRA
    // --------------------------------------------------

    const lugarCompra = lugar_compra.trim();

    if (
        lugarCompra.length < 2 ||
        lugarCompra.length > 150
    ) {
        return res.status(400).json({
            message:
                "El lugar de compra debe tener entre 2 y 150 caracteres"
        });
    }


    // --------------------------------------------------
    // VALIDAR TELÉFONO
    // --------------------------------------------------

    const telefonoLimpio = telefono_contacto
        .trim()
        .replace(/[\s-]/g, "");

    if (!/^\d{8}$/.test(telefonoLimpio)) {
        return res.status(400).json({
            message:
                "El teléfono debe contener 8 dígitos, por ejemplo 5555-5555"
        });
    }

    const telefonoContacto =
        `${telefonoLimpio.slice(0, 4)}-${telefonoLimpio.slice(4)}`;


    // --------------------------------------------------
    // VALIDAR TIPO DE SERVICIO
    // --------------------------------------------------

    const servicio =
        tipo_servicio.trim().toLowerCase();

    const serviciosPermitidos = [
        "restaurante",
        "supermercado"
    ];

    if (!serviciosPermitidos.includes(servicio)) {
        return res.status(400).json({
            message: "Tipo de servicio no válido"
        });
    }


    // --------------------------------------------------
    // VALIDAR TOTAL ESTIMADO
    // --------------------------------------------------

    const totalNumber = Number(total);

    if (!Number.isFinite(totalNumber)) {
        return res.status(400).json({
            message:
                "El total estimado debe ser un número válido"
        });
    }

    if (totalNumber <= 0) {
        return res.status(400).json({
            message:
                "El total estimado debe ser mayor que Q0.00"
        });
    }

    if (totalNumber > 99999999.99) {
        return res.status(400).json({
            message:
                "El total estimado excede el límite permitido"
        });
    }


    // --------------------------------------------------
    // VALIDAR UBICACIÓN DEL CLIENTE
    // --------------------------------------------------

    if (
        cliente_latitud === undefined ||
        cliente_latitud === null ||
        cliente_latitud === "" ||
        cliente_longitud === undefined ||
        cliente_longitud === null ||
        cliente_longitud === ""
    ) {
        return res.status(400).json({
            message:
                "Debe compartir la ubicación exacta de entrega"
        });
    }

    const latitud = Number(cliente_latitud);
    const longitud = Number(cliente_longitud);

    if (
        !Number.isFinite(latitud) ||
        !Number.isFinite(longitud)
    ) {
        return res.status(400).json({
            message:
                "La ubicación de entrega no es válida"
        });
    }

    if (
        latitud < -90 ||
        latitud > 90 ||
        longitud < -180 ||
        longitud > 180
    ) {
        return res.status(400).json({
            message:
                "Las coordenadas de entrega no son válidas"
        });
    }


    // --------------------------------------------------
    // CREAR PEDIDO
    // --------------------------------------------------

    orderModel.createOrder(
        clienteId,
        servicio,
        lugarCompra,
        descripcion.trim(),
        direccion.trim(),
        telefonoContacto,
        totalNumber,
        latitud,
        longitud,
        (err, result) => {

            if (err) {
                return responderErrorServidor(
                    res,
                    "Error al crear pedido",
                    err
                );
            }

            const pedidoId = result.insertId;


            // Guardar historial

            historyModel.createHistory(
                pedidoId,
                "pendiente",
                "Pedido creado por el cliente con ubicación de entrega confirmada",
                (historyError) => {
                    if (historyError) {
                        console.error(
                            "Error creando historial:",
                            historyError
                        );
                    }
                }
            );


            // Avisar por Socket.io

            emitPedidoActualizado(
                req,
                pedidoId,
                {
                    estado: "pendiente",
                    lugar_compra: lugarCompra,
                    telefono_contacto: telefonoContacto,
                    cliente_latitud: latitud,
                    cliente_longitud: longitud
                }
            );


            return res.status(201).json({
                message:
                    "Pedido creado correctamente",
                pedido_id: pedidoId
            });
        }
    );
};

// ======================================================
// PEDIDOS DEL CLIENTE
// ======================================================

const getMyOrders = (req, res) => {
    const clienteId = req.user.id;

    orderModel.getOrdersByClient(
        clienteId,
        (err, results) => {
            if (err) {
                return responderErrorServidor(
                    res,
                    "Error al obtener pedidos",
                    err
                );
            }

            return res.json({
                message: "Pedidos del cliente",
                pedidos: results
            });
        }
    );
};


// ======================================================
// PEDIDOS PENDIENTES
// REPARTIDOR
// ======================================================

const getPendingOrders = (req, res) => {
    orderModel.getPendingOrders(
        (err, results) => {
            if (err) {
                return responderErrorServidor(
                    res,
                    "Error al obtener pedidos pendientes",
                    err
                );
            }

            return res.json({
                message: "Pedidos pendientes",
                pedidos: results
            });
        }
    );
};


// ======================================================
// ENTREGAS DEL REPARTIDOR
// ======================================================

const getMyDeliveries = (req, res) => {
    const repartidorId = req.user.id;

    orderModel.getOrdersByDelivery(
        repartidorId,
        (err, results) => {
            if (err) {
                return responderErrorServidor(
                    res,
                    "Error al obtener entregas",
                    err
                );
            }

            return res.json({
                message:
                    "Pedidos asignados al repartidor",
                pedidos: results
            });
        }
    );
};


// ======================================================
// ACEPTAR PEDIDO
// ======================================================

const acceptOrder = (req, res) => {
    const repartidorId = req.user.id;
    const pedidoId = req.params.id;

    if (!pedidoIdValido(pedidoId)) {
        return res.status(400).json({
            message: "ID de pedido no válido"
        });
    }

    orderModel.acceptOrder(
        pedidoId,
        repartidorId,
        (err, result) => {
            if (err) {
                return responderErrorServidor(
                    res,
                    "Error al aceptar pedido",
                    err
                );
            }

            if (result.affectedRows === 0) {
                return res.status(409).json({
                    message:
                        "El pedido ya fue aceptado o no está disponible"
                });
            }


            historyModel.createHistory(
                pedidoId,
                "aceptado",
                "Pedido aceptado por el repartidor",
                (historyError) => {
                    if (historyError) {
                        console.error(
                            "Error creando historial:",
                            historyError
                        );
                    }
                }
            );


            emitPedidoActualizado(
                req,
                pedidoId,
                {
                    estado: "aceptado",
                    repartidor_id:
                        Number(repartidorId)
                }
            );


            return res.json({
                message:
                    "Pedido aceptado correctamente"
            });
        }
    );
};


// ======================================================
// RECHAZAR PEDIDO
// ======================================================

const rejectOrder = (req, res) => {
    const repartidorId = req.user.id;
    const pedidoId = req.params.id;

    if (!pedidoIdValido(pedidoId)) {
        return res.status(400).json({
            message: "ID de pedido no válido"
        });
    }


    orderModel.rejectOrder(
        pedidoId,
        repartidorId,
        (err, result) => {
            if (err) {
                return responderErrorServidor(
                    res,
                    "Error al rechazar pedido",
                    err
                );
            }

            if (result.affectedRows === 0) {
                return res.status(400).json({
                    message:
                        "Solo puede rechazar un pedido aceptado por usted"
                });
            }


            historyModel.createHistory(
                pedidoId,
                "pendiente",
                "Pedido rechazado por el repartidor y devuelto a pendientes",
                (historyError) => {
                    if (historyError) {
                        console.error(
                            "Error creando historial:",
                            historyError
                        );
                    }
                }
            );


            emitPedidoActualizado(
                req,
                pedidoId,
                {
                    estado: "pendiente",
                    repartidor_id: null
                }
            );


            return res.json({
                message:
                    "Pedido rechazado correctamente"
            });
        }
    );
};

const cancelOrder = (req, res) => {
    const repartidorId = req.user.id;
    const pedidoId = req.params.id;

    if (!pedidoIdValido(pedidoId)) {
        return res.status(400).json({
            message: "ID de pedido no válido"
        });
    }

    orderModel.cancelOrder(
        pedidoId,
        repartidorId,
        (err, result) => {
            if (err) {
                return responderErrorServidor(
                    res,
                    "Error al cancelar pedido",
                    err
                );
            }

            if (result.affectedRows === 0) {
                return res.status(400).json({
                    message:
                        "Solo puede cancelar un pedido asignado a usted que esté Aceptado o En camino"
                });
            }

            historyModel.createHistory(
                pedidoId,
                "cancelado",
                "Pedido cancelado por el repartidor",
                (historyError) => {
                    if (historyError) {
                        console.error(
                            "Error creando historial:",
                            historyError
                        );
                    }
                }
            );

            emitPedidoActualizado(
                req,
                pedidoId,
                {
                    estado: "cancelado",
                    repartidor_id: repartidorId
                }
            );

            return res.json({
                message: "Pedido cancelado correctamente"
            });
        }
    );
};

// ======================================================
// CANCELAR PEDIDO POR EL CLIENTE
// PENDIENTE o ACEPTADO -> CANCELADO
// ======================================================
const cancelOrderByClient = (req, res) => {
    const clienteId = req.user.id;
    const pedidoId = req.params.id;
    const motivo = String(req.body?.motivo || "").trim();

    if (!pedidoIdValido(pedidoId)) {
        return res.status(400).json({
            message: "ID de pedido no válido"
        });
    }

    if (motivo.length > 300) {
        return res.status(400).json({
            message: "El motivo no puede superar 300 caracteres"
        });
    }

    orderModel.cancelOrderByClient(
        pedidoId,
        clienteId,
        (err, result) => {
            if (err) {
                return responderErrorServidor(
                    res,
                    "Error al cancelar pedido",
                    err
                );
            }

            if (result.affectedRows === 0) {
                return res.status(409).json({
                    message:
                        "Solo puede cancelar uno de sus pedidos mientras esté Pendiente o Aceptado"
                });
            }

            const comentario = motivo
                ? `Pedido cancelado por el cliente. Motivo: ${motivo}`
                : "Pedido cancelado por el cliente";

            historyModel.createHistory(
                pedidoId,
                "cancelado",
                comentario,
                (historyError) => {
                    if (historyError) {
                        console.error(
                            "Error creando historial:",
                            historyError
                        );
                    }
                }
            );

            emitPedidoActualizado(
                req,
                pedidoId,
                {
                    estado: "cancelado",
                    cancelado_por: "cliente"
                }
            );

            return res.json({
                message: "Pedido cancelado correctamente"
            });
        }
    );
};


// ======================================================
// ACTUALIZAR ESTADO
// ACEPTADO -> EN CAMINO
// ======================================================

const updateOrderStatus = (req, res) => {
    const repartidorId = req.user.id;
    const pedidoId = req.params.id;

    const { estado } = req.body || {};


    if (!pedidoIdValido(pedidoId)) {
        return res.status(400).json({
            message: "ID de pedido no válido"
        });
    }


    if (
        !estado ||
        typeof estado !== "string"
    ) {
        return res.status(400).json({
            message:
                "Debe indicar el nuevo estado"
        });
    }


    const estadoLimpio =
        estado.trim().toLowerCase();


    if (estadoLimpio !== "en camino") {
        return res.status(400).json({
            message:
                "Desde este proceso solo puede cambiar el pedido a 'en camino'"
        });
    }


    orderModel.markOnTheWay(
        pedidoId,
        repartidorId,
        (err, result) => {
            if (err) {
                return responderErrorServidor(
                    res,
                    "Error al actualizar estado",
                    err
                );
            }

            if (result.affectedRows === 0) {
                return res.status(400).json({
                    message:
                        "El pedido debe estar aceptado y asignado a usted"
                });
            }


            historyModel.createHistory(
                pedidoId,
                "en camino",
                "El repartidor inició el recorrido de entrega",
                (historyError) => {
                    if (historyError) {
                        console.error(
                            "Error creando historial:",
                            historyError
                        );
                    }
                }
            );


            emitPedidoActualizado(
                req,
                pedidoId,
                {
                    estado: "en camino"
                }
            );


            return res.json({
                message:
                    "Pedido actualizado a en camino"
            });
        }
    );
};


// ======================================================
// CONFIRMAR TOTAL REAL
// ======================================================

const confirmRealTotal = (req, res) => {
    const repartidorId = req.user.id;
    const pedidoId = req.params.id;

    const { total_real } = req.body || {};


    if (!pedidoIdValido(pedidoId)) {
        return res.status(400).json({
            message:
                "ID de pedido no válido"
        });
    }


    if (
        total_real === undefined ||
        total_real === null ||
        total_real === ""
    ) {
        return res.status(400).json({
            message:
                "El total real es obligatorio"
        });
    }


    const totalRealNumber =
        Number(total_real);


    if (
        !Number.isFinite(
            totalRealNumber
        )
    ) {
        return res.status(400).json({
            message:
                "El total real debe ser un número válido"
        });
    }


    if (totalRealNumber <= 0) {
        return res.status(400).json({
            message:
                "El total real debe ser mayor que Q0.00"
        });
    }


    if (
        totalRealNumber >
        99999999.99
    ) {
        return res.status(400).json({
            message:
                "El total real excede el límite permitido"
        });
    }


    /*
        Consultamos el pedido directamente
        en MySQL para NO confiar en el total
        estimado enviado por el navegador.
    */

    orderModel.getOrderById(
        pedidoId,
        (pedidoError, pedidos) => {
            if (pedidoError) {
                return responderErrorServidor(
                    res,
                    "Error al consultar pedido",
                    pedidoError
                );
            }


            if (!pedidos.length) {
                return res.status(404).json({
                    message:
                        "Pedido no encontrado"
                });
            }


            const pedido = pedidos[0];


            // Debe pertenecer al repartidor

            if (
                Number(
                    pedido.repartidor_id
                ) !==
                Number(repartidorId)
            ) {
                return res.status(403).json({
                    message:
                        "Este pedido no está asignado a usted"
                });
            }


            // Solo aceptado o en camino

            if (
                pedido.estado !==
                    "aceptado" &&
                pedido.estado !==
                    "en camino"
            ) {
                return res.status(400).json({
                    message:
                        "No puede confirmar el total en el estado actual del pedido"
                });
            }


            // No modificar total confirmado

            if (
                pedido.total_real !== null &&
                pedido.total_real !==
                    undefined
            ) {
                return res.status(400).json({
                    message:
                        "El total real ya fue confirmado y no puede modificarse"
                });
            }


            const totalEstimado =
                Number(pedido.total);


            const diferencia =
                Number(
                    (
                        totalRealNumber -
                        totalEstimado
                    ).toFixed(2)
                );


            orderModel.confirmRealTotal(
                pedidoId,
                repartidorId,
                totalRealNumber,
                (err, result) => {
                    if (err) {
                        return responderErrorServidor(
                            res,
                            "Error al confirmar total real",
                            err
                        );
                    }


                    if (
                        result.affectedRows ===
                        0
                    ) {
                        return res.status(400).json({
                            message:
                                "No se pudo confirmar el total real"
                        });
                    }


                    historyModel.createHistory(
                        pedidoId,
                        "total confirmado",
                        `Total real confirmado: Q${totalRealNumber.toFixed(
                            2
                        )}. Diferencia: Q${diferencia.toFixed(
                            2
                        )}`,
                        (historyError) => {
                            if (historyError) {
                                console.error(
                                    "Error creando historial:",
                                    historyError
                                );
                            }
                        }
                    );


                    emitPedidoActualizado(
                        req,
                        pedidoId,
                        {
                            total_real:
                                totalRealNumber,
                            diferencia
                        }
                    );


                    return res.json({
                        message:
                            "Total real confirmado correctamente",

                        total_estimado:
                            totalEstimado,

                        total_real:
                            totalRealNumber,

                        diferencia
                    });
                }
            );
        }
    );
};


// ======================================================
// CONFIRMAR ENTREGA
// ======================================================

const confirmDelivery = (req, res) => {
    const repartidorId = req.user.id;
    const pedidoId = req.params.id;

    const {
        observacion_entrega
    } = req.body || {};


    if (!pedidoIdValido(pedidoId)) {
        return res.status(400).json({
            message:
                "ID de pedido no válido"
        });
    }


    if (
        !observacion_entrega ||
        typeof observacion_entrega !==
            "string" ||
        !observacion_entrega.trim()
    ) {
        return res.status(400).json({
            message:
                "La observación de entrega es obligatoria"
        });
    }


    const observacion =
        observacion_entrega.trim();


    if (
        observacion.length > 255
    ) {
        return res.status(400).json({
            message:
                "La observación no puede superar los 255 caracteres"
        });
    }


    orderModel.confirmDelivery(
        pedidoId,
        repartidorId,
        observacion,
        (err, result) => {
            if (err) {
                return responderErrorServidor(
                    res,
                    "Error al confirmar entrega",
                    err
                );
            }


            if (
                result.affectedRows ===
                0
            ) {
                return res.status(400).json({
                    message:
                        "Para entregar, el pedido debe estar en camino, pertenecerle y tener el total real confirmado"
                });
            }


            historyModel.createHistory(
                pedidoId,
                "entregado",
                `Pedido entregado. Observación: ${observacion}`,
                (historyError) => {
                    if (historyError) {
                        console.error(
                            "Error creando historial:",
                            historyError
                        );
                    }
                }
            );


            emitPedidoActualizado(
                req,
                pedidoId,
                {
                    estado:
                        "entregado",

                    observacion_entrega:
                        observacion,

                    fecha_entrega:
                        new Date().toISOString()
                }
            );


            return res.json({
                message:
                    "Entrega confirmada correctamente"
            });
        }
    );
};


// ======================================================
// CONFIRMACIÓN DE RECEPCIÓN DEL CLIENTE
// ======================================================

const confirmClientReception = (
    req,
    res
) => {

    const clienteId =
        req.user.id;

    const pedidoId =
        req.params.id;


    const {
        confirmacion_cliente,
        comentario_cliente
    } = req.body || {};


    if (!pedidoIdValido(pedidoId)) {
        return res.status(400).json({
            message:
                "ID de pedido no válido"
        });
    }


    const confirmacionesPermitidas = [
        "confirmado",
        "problema"
    ];


    if (
        !confirmacionesPermitidas.includes(
            confirmacion_cliente
        )
    ) {
        return res.status(400).json({
            message:
                "Confirmación no válida"
        });
    }


    if (
        confirmacion_cliente ===
            "problema" &&
        (
            !comentario_cliente ||
            typeof comentario_cliente !==
                "string" ||
            !comentario_cliente.trim()
        )
    ) {
        return res.status(400).json({
            message:
                "Debe escribir el motivo del problema"
        });
    }


    const comentarioFinal =
        typeof comentario_cliente ===
            "string" &&
        comentario_cliente.trim()
            ? comentario_cliente.trim()
            : null;


    if (
        comentarioFinal &&
        comentarioFinal.length > 255
    ) {
        return res.status(400).json({
            message:
                "El comentario no puede superar los 255 caracteres"
        });
    }


    orderModel.confirmClientReception(
        pedidoId,
        clienteId,
        confirmacion_cliente,
        comentarioFinal,
        (err, result) => {
            if (err) {
                return responderErrorServidor(
                    res,
                    "Error al confirmar recepción",
                    err
                );
            }


            if (
                result.affectedRows ===
                0
            ) {
                return res.status(400).json({
                    message:
                        "El pedido no está entregado, no le pertenece o ya fue confirmado"
                });
            }


            const comentarioHistorial =
                confirmacion_cliente ===
                "confirmado"
                    ? "Cliente confirmó que recibió el pedido correctamente"
                    : `Cliente reportó un problema: ${comentarioFinal}`;


            historyModel.createHistory(
                pedidoId,
                confirmacion_cliente,
                comentarioHistorial,
                (historyError) => {
                    if (historyError) {
                        console.error(
                            "Error creando historial:",
                            historyError
                        );
                    }
                }
            );


            emitPedidoActualizado(
                req,
                pedidoId,
                {
                    confirmacion_cliente,
                    comentario_cliente:
                        comentarioFinal,

                    fecha_confirmacion_cliente:
                        new Date().toISOString()
                }
            );


            return res.json({
                message:
                    "Confirmación del cliente registrada correctamente"
            });
        }
    );
};


// ======================================================
// REACTIVAR PEDIDO CANCELADO
// ADMIN
// ======================================================

const reactivateCancelledOrder = (
    req,
    res
) => {

    const pedidoId =
        req.params.id;

    const {
        repartidor_id
    } = req.body || {};


    if (!pedidoIdValido(pedidoId)) {
        return res.status(400).json({
            message:
                "ID de pedido no válido"
        });
    }


    if (
        !repartidor_id ||
        !Number.isInteger(
            Number(repartidor_id)
        ) ||
        Number(repartidor_id) <= 0
    ) {
        return res.status(400).json({
            message:
                "Debe seleccionar un repartidor válido"
        });
    }


    orderModel.reactivateCancelledOrder(
        pedidoId,
        Number(repartidor_id),
        (err, result) => {
            if (err) {
                return responderErrorServidor(
                    res,
                    "Error al reactivar pedido",
                    err
                );
            }


            if (
                result.affectedRows ===
                0
            ) {
                return res.status(400).json({
                    message:
                        "El pedido debe estar cancelado y el repartidor seleccionado debe estar activo"
                });
            }


            historyModel.createHistory(
                pedidoId,
                "reactivado",
                `Pedido reactivado por administrador y asignado al repartidor ID ${Number(
                    repartidor_id
                )}`,
                (historyError) => {
                    if (historyError) {
                        console.error(
                            "Error creando historial:",
                            historyError
                        );
                    }
                }
            );


            emitPedidoActualizado(
                req,
                pedidoId,
                {
                    estado:
                        "aceptado",

                    repartidor_id:
                        Number(
                            repartidor_id
                        ),

                    observacion_entrega:
                        null,

                    fecha_entrega:
                        null,

                    confirmacion_cliente:
                        null,

                    comentario_cliente:
                        null,

                    fecha_confirmacion_cliente:
                        null,

                    total_real:
                        null,

                    diferencia:
                        null
                }
            );


            return res.json({
                message:
                    "Pedido reactivado correctamente"
            });
        }
    );
};


// ======================================================
// TODOS LOS PEDIDOS
// ADMIN
// ======================================================

const getAllOrders = (req, res) => {

    orderModel.getAllOrders(
        (err, results) => {
            if (err) {
                return responderErrorServidor(
                    res,
                    "Error al obtener pedidos",
                    err
                );
            }


            return res.json({
                message:
                    "Todos los pedidos",

                pedidos:
                    results
            });
        }
    );
};


// ======================================================
// HISTORIAL DEL PEDIDO
// ======================================================

const getOrderHistory = (req, res) => {

    const pedidoId =
        req.params.id;

    const usuarioId =
        Number(req.user.id);

    const rol =
        req.user.rol;


    if (!pedidoIdValido(pedidoId)) {
        return res.status(400).json({
            message:
                "ID de pedido no válido"
        });
    }


    /*
        Primero comprobamos quién es dueño
        o responsable del pedido.

        ADMIN:
        puede consultar cualquiera.

        CLIENTE:
        solo sus pedidos.

        REPARTIDOR:
        solo los asignados a él.
    */

    orderModel.getOrderById(
        pedidoId,
        (pedidoError, pedidos) => {

            if (pedidoError) {
                return responderErrorServidor(
                    res,
                    "Error al consultar pedido",
                    pedidoError
                );
            }


            if (!pedidos.length) {
                return res.status(404).json({
                    message:
                        "Pedido no encontrado"
                });
            }


            const pedido =
                pedidos[0];


            let autorizado =
                false;


            if (rol === "admin") {
                autorizado = true;
            }


            if (
                rol === "cliente" &&
                Number(
                    pedido.cliente_id
                ) === usuarioId
            ) {
                autorizado = true;
            }


            if (
                rol === "repartidor" &&
                Number(
                    pedido.repartidor_id
                ) === usuarioId
            ) {
                autorizado = true;
            }


            if (!autorizado) {
                return res.status(403).json({
                    message:
                        "No tiene permiso para consultar el historial de este pedido"
                });
            }


            historyModel.getHistoryByOrder(
                pedidoId,
                (err, results) => {

                    if (err) {
                        return responderErrorServidor(
                            res,
                            "Error al obtener historial",
                            err
                        );
                    }


                    return res.json({
                        message:
                            "Historial del pedido",

                        historial:
                            results
                    });
                }
            );
        }
    );
};


// ======================================================
// EXPORTAR CONTROLADORES
// ======================================================

module.exports = {
    createOrder,
    getMyOrders,
    getPendingOrders,
    getMyDeliveries,
    acceptOrder,
    rejectOrder,
    updateOrderStatus,
    confirmRealTotal,
    confirmDelivery,
    confirmClientReception,
    reactivateCancelledOrder,
    getAllOrders,
    getOrderHistory,
    cancelOrder,
    cancelOrderByClient
};