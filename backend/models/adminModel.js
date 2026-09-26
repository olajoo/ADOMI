const db = require("../config/db");

const getAllUsers = (callback) => {
    const sql = `
        SELECT id, nombre, correo, rol, estado, created_at
        FROM usuarios
        ORDER BY created_at DESC
    `;

    db.query(sql, callback);
};

const getUsersByRole = (rol, callback) => {
    const sql = `
        SELECT id, nombre, correo, rol, estado, created_at
        FROM usuarios
        WHERE rol = ?
        ORDER BY created_at DESC
    `;

    db.query(sql, [rol], callback);
};

const updateUserStatus = (userId, estado, callback) => {
    const sql = `
        UPDATE usuarios
        SET estado = ?
        WHERE id = ?
    `;

    db.query(sql, [estado, userId], callback);
};

const getDashboardStats = (callback) => {
    const sql = `
        SELECT
            (SELECT COUNT(*) FROM usuarios WHERE rol = 'cliente') AS total_clientes,
            (SELECT COUNT(*) FROM usuarios WHERE rol = 'repartidor') AS total_repartidores,
            (SELECT COUNT(*) FROM pedidos) AS total_pedidos,
            (SELECT COUNT(*) FROM pedidos WHERE estado = 'pendiente') AS pedidos_pendientes,
            (SELECT COUNT(*) FROM pedidos WHERE estado = 'aceptado') AS pedidos_aceptados,
            (SELECT COUNT(*) FROM pedidos WHERE estado = 'en camino') AS pedidos_en_camino,
            (SELECT COUNT(*) FROM pedidos WHERE estado = 'entregado') AS pedidos_entregados,
            (SELECT COUNT(*) FROM pedidos WHERE estado = 'cancelado') AS pedidos_cancelados,
            (SELECT IFNULL(SUM(total_real), 0) FROM pedidos WHERE estado = 'entregado') AS ingresos_entregados
    `;

    db.query(sql, callback);
};

const getReportSummary = (fechaInicio, fechaFin, callback) => {
    const sql = `
        SELECT
            COUNT(*) AS total_pedidos,
            SUM(CASE WHEN estado = 'pendiente' THEN 1 ELSE 0 END) AS pendientes,
            SUM(CASE WHEN estado = 'aceptado' THEN 1 ELSE 0 END) AS aceptados,
            SUM(CASE WHEN estado = 'en camino' THEN 1 ELSE 0 END) AS en_camino,
            SUM(CASE WHEN estado = 'entregado' THEN 1 ELSE 0 END) AS entregados,
            SUM(CASE WHEN estado = 'cancelado' THEN 1 ELSE 0 END) AS cancelados,
            IFNULL(
                SUM(
                    CASE
                        WHEN estado = 'entregado'
                        THEN total_real
                        ELSE 0
                    END
                ),
                0
            ) AS total_entregado,
            SUM(
            CASE
            WHEN confirmacion_cliente = 'problema'
            AND incidencia_resuelta = 0
            THEN 1
            ELSE 0
            END
            ) AS incidencias_pendientes
        FROM pedidos
        WHERE DATE(created_at) BETWEEN ? AND ?
    `;

    db.query(sql, [fechaInicio, fechaFin], callback);
};

const getReportByService = (fechaInicio, fechaFin, callback) => {
    const sql = `
        SELECT
            tipo_servicio,
            COUNT(*) AS total
        FROM pedidos
        WHERE DATE(created_at) BETWEEN ? AND ?
        GROUP BY tipo_servicio
        ORDER BY total DESC
    `;

    db.query(sql, [fechaInicio, fechaFin], callback);
};

const getReportByStatus = (fechaInicio, fechaFin, callback) => {
    const sql = `
        SELECT
            estado,
            COUNT(*) AS total
        FROM pedidos
        WHERE DATE(created_at) BETWEEN ? AND ?
        GROUP BY estado
        ORDER BY total DESC
    `;

    db.query(sql, [fechaInicio, fechaFin], callback);
};

const getCourierPerformance = (fechaInicio, fechaFin, callback) => {
    const sql = `
        SELECT
            u.id,
            u.nombre,
            u.correo,
            COUNT(p.id) AS pedidos_asignados,
            SUM(CASE WHEN p.estado = 'entregado' THEN 1 ELSE 0 END) AS entregados,
            SUM(CASE WHEN p.estado = 'cancelado' THEN 1 ELSE 0 END) AS cancelados,
            IFNULL(
                SUM(
                    CASE
                        WHEN p.estado = 'entregado'
                        THEN p.total_real
                        ELSE 0
                    END
                ),
                0
            ) AS total_entregado
        FROM usuarios u
        LEFT JOIN pedidos p
            ON p.repartidor_id = u.id
            AND DATE(p.created_at) BETWEEN ? AND ?
        WHERE u.rol = 'repartidor'
        GROUP BY u.id, u.nombre, u.correo
        ORDER BY entregados DESC, pedidos_asignados DESC
    `;

    db.query(sql, [fechaInicio, fechaFin], callback);
};

const getReportOrders = (fechaInicio, fechaFin, callback) => {
    const sql = `
        SELECT
            p.id,
            p.tipo_servicio,
            p.lugar_compra,
            p.estado,
            p.total,
            p.total_real,
            p.created_at,
            p.fecha_entrega,
            c.nombre AS cliente,
            r.nombre AS repartidor
        FROM pedidos p
        INNER JOIN usuarios c
            ON c.id = p.cliente_id
        LEFT JOIN usuarios r
            ON r.id = p.repartidor_id
        WHERE DATE(p.created_at) BETWEEN ? AND ?
        ORDER BY p.created_at DESC
    `;

    db.query(sql, [fechaInicio, fechaFin], callback);
};

module.exports = {
    getAllUsers,
    getUsersByRole,
    updateUserStatus,
    getDashboardStats,
    getReportSummary,
    getReportByService,
    getReportByStatus,
    getCourierPerformance,
    getReportOrders
};