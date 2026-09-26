const db = require("../config/db");

// ======================================================
// CREAR PEDIDO
// ======================================================
const createOrder = (
    clienteId,
    tipoServicio,
    lugarCompra,
    descripcion,
    direccion,
    telefonoContacto,
    total,
    clienteLatitud,
    clienteLongitud,
    callback
) => {

    const sql = `
        INSERT INTO pedidos
        (
            cliente_id,
            tipo_servicio,
            lugar_compra,
            descripcion,
            direccion,
            telefono_contacto,
            total,
            cliente_latitud,
            cliente_longitud
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(
        sql,
        [
            clienteId,
            tipoServicio,
            lugarCompra,
            descripcion,
            direccion,
            telefonoContacto,
            total,
            clienteLatitud,
            clienteLongitud
        ],
        callback
    );
};

// ======================================================
// OBTENER PEDIDO POR ID
// ======================================================

const getOrderById = (pedidoId, callback) => {
    const sql = `
        SELECT *
        FROM pedidos
        WHERE id = ?
        LIMIT 1
    `;

    db.query(sql, [pedidoId], callback);
};


// ======================================================
// PEDIDOS DEL CLIENTE
// ======================================================

const getOrdersByClient = (
    clienteId,
    callback
) => {
    const sql = `
        SELECT *
        FROM pedidos
        WHERE cliente_id = ?
        ORDER BY created_at DESC
    `;

    db.query(
        sql,
        [clienteId],
        callback
    );
};


// ======================================================
// PEDIDOS PENDIENTES
// ======================================================

const getPendingOrders = (callback) => {

    const sql = `
        SELECT
            pedidos.id,
            pedidos.cliente_id,
            pedidos.tipo_servicio,
            pedidos.lugar_compra,
            pedidos.descripcion,
            pedidos.direccion,
            pedidos.estado,
            pedidos.total,
            pedidos.created_at,
            pedidos.cliente_latitud,
            pedidos.cliente_longitud,
            usuarios.nombre AS cliente_nombre
        FROM pedidos

        INNER JOIN usuarios
            ON pedidos.cliente_id = usuarios.id

        WHERE pedidos.estado = 'pendiente'
        AND pedidos.repartidor_id IS NULL

        ORDER BY pedidos.created_at ASC
    `;

    db.query(sql, callback);
};


// ======================================================
// PEDIDOS DEL REPARTIDOR
// ======================================================

const getOrdersByDelivery = (
    repartidorId,
    callback
) => {
    const sql = `
        SELECT
            pedidos.*,
            usuarios.nombre AS cliente_nombre,
            usuarios.correo AS cliente_correo
        FROM pedidos
        INNER JOIN usuarios
            ON pedidos.cliente_id = usuarios.id
        WHERE pedidos.repartidor_id = ?
        ORDER BY pedidos.created_at DESC
    `;

    db.query(
        sql,
        [repartidorId],
        callback
    );
};


// ======================================================
// ACEPTAR PEDIDO
// ======================================================

const acceptOrder = (
    pedidoId,
    repartidorId,
    callback
) => {
    const sql = `
        UPDATE pedidos
        SET
            estado = 'aceptado',
            repartidor_id = ?
        WHERE id = ?
        AND estado = 'pendiente'
        AND repartidor_id IS NULL
    `;

    db.query(
        sql,
        [repartidorId, pedidoId],
        callback
    );
};


// ======================================================
// RECHAZAR PEDIDO
// ======================================================

const rejectOrder = (
    pedidoId,
    repartidorId,
    callback
) => {
    const sql = `
        UPDATE pedidos
        SET
            estado = 'pendiente',
            repartidor_id = NULL
        WHERE id = ?
        AND repartidor_id = ?
        AND estado = 'aceptado'
    `;

    db.query(
        sql,
        [pedidoId, repartidorId],
        callback
    );
};


// ======================================================
// CAMBIAR A EN CAMINO
// ======================================================

const markOnTheWay = (
    pedidoId,
    repartidorId,
    callback
) => {
    const sql = `
        UPDATE pedidos
        SET estado = 'en camino'
        WHERE id = ?
        AND repartidor_id = ?
        AND estado = 'aceptado'
    `;

    db.query(
        sql,
        [pedidoId, repartidorId],
        callback
    );
};


const cancelOrder = (
    pedidoId,
    repartidorId,
    callback
) => {
    const sql = `
        UPDATE pedidos
        SET
            estado = 'cancelado',
            cancelado_por = 'repartidor'
        WHERE id = ?
        AND repartidor_id = ?
        AND estado IN ('aceptado', 'en camino')
    `;

    db.query(
        sql,
        [pedidoId, repartidorId],
        callback
    );
};


const cancelOrderByClient = (
    pedidoId,
    clienteId,
    callback
) => {
    const sql = `
        UPDATE pedidos
        SET
            estado = 'cancelado',
            cancelado_por = 'cliente'
        WHERE id = ?
        AND cliente_id = ?
        AND estado IN ('pendiente', 'aceptado')
    `;

    db.query(
        sql,
        [pedidoId, clienteId],
        callback
    );
};



const confirmRealTotal = (
    pedidoId,
    repartidorId,
    totalReal,
    callback
) => {
    /*
        IMPORTANTE:

        La diferencia se calcula usando el total almacenado
        realmente en MySQL.

        Ya no confiamos en un "total_estimado" enviado por
        el navegador.
    */

    const sql = `
        UPDATE pedidos
        SET
            total_real = ?,
            diferencia = ? - total
        WHERE id = ?
        AND repartidor_id = ?
        AND estado IN ('aceptado', 'en camino')
        AND total_real IS NULL
    `;

    db.query(
        sql,
        [
            totalReal,
            totalReal,
            pedidoId,
            repartidorId
        ],
        callback
    );
};


// ======================================================
// CONFIRMAR ENTREGA
// ======================================================

const confirmDelivery = (
    pedidoId,
    repartidorId,
    observacionEntrega,
    callback
) => {
    const sql = `
        UPDATE pedidos
        SET
            estado = 'entregado',
            observacion_entrega = ?,
            fecha_entrega = CURRENT_TIMESTAMP
        WHERE id = ?
        AND repartidor_id = ?
        AND estado = 'en camino'
        AND total_real IS NOT NULL
    `;

    db.query(
        sql,
        [
            observacionEntrega,
            pedidoId,
            repartidorId
        ],
        callback
    );
};


// ======================================================
// CONFIRMACIÓN DEL CLIENTE
// ======================================================

const confirmClientReception = (
    pedidoId,
    clienteId,
    confirmacionCliente,
    comentarioCliente,
    callback
) => {
    const sql = `
        UPDATE pedidos
        SET
            confirmacion_cliente = ?,
            comentario_cliente = ?,
            fecha_confirmacion_cliente =
                CURRENT_TIMESTAMP
        WHERE id = ?
        AND cliente_id = ?
        AND estado = 'entregado'
        AND confirmacion_cliente IS NULL
    `;

    db.query(
        sql,
        [
            confirmacionCliente,
            comentarioCliente,
            pedidoId,
            clienteId
        ],
        callback
    );
};


// ======================================================
// REACTIVAR PEDIDO CANCELADO - ADMIN
// ======================================================

const reactivateCancelledOrder = (
    pedidoId,
    repartidorId,
    callback
) => {
    /*
        Solo se asignará si el usuario seleccionado
        realmente existe, es repartidor y está activo.
    */

    const sql = `
        UPDATE pedidos
        SET
            estado = 'aceptado',
            repartidor_id = ?,
            observacion_entrega = NULL,
            fecha_entrega = NULL,
            confirmacion_cliente = NULL,
            comentario_cliente = NULL,
            fecha_confirmacion_cliente = NULL,
            total_real = NULL,
            diferencia = NULL
        WHERE id = ?
        AND estado = 'cancelado'
        AND EXISTS (
            SELECT 1
            FROM usuarios
            WHERE usuarios.id = ?
            AND usuarios.rol = 'repartidor'
            AND usuarios.estado = 'activo'
        )
    `;

    db.query(
        sql,
        [
            repartidorId,
            pedidoId,
            repartidorId
        ],
        callback
    );
};


// ======================================================
// TODOS LOS PEDIDOS - ADMIN
// ======================================================

const getAllOrders = (callback) => {
    const sql = `
        SELECT
            pedidos.*,
            cliente.nombre AS cliente_nombre,
            repartidor.nombre AS repartidor_nombre
        FROM pedidos

        INNER JOIN usuarios AS cliente
            ON pedidos.cliente_id = cliente.id

        LEFT JOIN usuarios AS repartidor
            ON pedidos.repartidor_id = repartidor.id

        ORDER BY pedidos.created_at DESC
    `;

    db.query(sql, callback);

};

// ======================================================
// RESOLVER INCIDENCIA - ADMIN
// ======================================================

const resolveIncident = (
    pedidoId,
    resolucionAdmin,
    callback
) => {

    const sql = `
        UPDATE pedidos
        SET
            incidencia_resuelta = 1,
            resolucion_admin = ?,
            fecha_resolucion = CURRENT_TIMESTAMP
        WHERE id = ?
        AND estado = 'entregado'
        AND confirmacion_cliente = 'problema'
        AND incidencia_resuelta = 0
    `;

    db.query(
        sql,
        [
            resolucionAdmin,
            pedidoId
        ],
        callback
    );
};

// ======================================================
// CORREGIR PEDIDO CANCELADO - ADMIN
// ======================================================

const correctCancelledOrder = (
    pedidoId,
    lugarCompra,
    descripcion,
    direccion,
    telefonoContacto,
    total,
    callback
) => {
    const sql = `
        UPDATE pedidos
        SET
            lugar_compra = ?,
            descripcion = ?,
            direccion = ?,
            telefono_contacto = ?,
            total = ?
        WHERE id = ?
        AND estado = 'cancelado'
    `;

    db.query(
        sql,
        [
            lugarCompra,
            descripcion,
            direccion,
            telefonoContacto,
            total,
            pedidoId
        ],
        callback
    );
};


// ======================================================
// EXPORTAR
// ======================================================

module.exports = {
    createOrder,
    getOrderById,
    getOrdersByClient,
    getPendingOrders,
    getOrdersByDelivery,
    acceptOrder,
    rejectOrder,
    markOnTheWay,
    cancelOrder,
    cancelOrderByClient,
    confirmRealTotal,
    confirmDelivery,
    confirmClientReception,
    reactivateCancelledOrder,
    getAllOrders,
    resolveIncident,
    correctCancelledOrder
};