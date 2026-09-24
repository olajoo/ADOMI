import api from "../api/api";

const getToken = () => {
    return localStorage.getItem("token");
};

const config = () => {
    return {
        headers: {
            Authorization: `Bearer ${getToken()}`
        }
    };
};

// =========================
// CLIENTE
// =========================

export const createOrder = async (orderData) => {
    const response = await api.post(
        "/orders",
        orderData,
        config()
    );

    return response.data;
};

export const getMyOrders = async () => {
    const response = await api.get(
        "/orders/my-orders",
        config()
    );

    return response.data;
};

export const cancelClientOrder = async (orderId, motivo = "") => {
    const response = await api.put(
        `/orders/${orderId}/cancelar-cliente`,
        { motivo },
        config()
    );

    return response.data;
};

export const confirmClientReception = async (
    orderId,
    confirmacionCliente,
    comentarioCliente
) => {
    const response = await api.put(
        `/orders/${orderId}/confirmar-recepcion`,
        {
            confirmacion_cliente: confirmacionCliente,
            comentario_cliente: comentarioCliente
        },
        config()
    );

    return response.data;
};

// =========================
// HISTORIAL
// =========================

export const getOrderHistory = async (orderId) => {
    const response = await api.get(
        `/orders/${orderId}/history`,
        config()
    );

    return response.data;
};

// =========================
// REPARTIDOR
// =========================

export const getPendingOrders = async () => {
    const response = await api.get(
        "/orders/pending",
        config()
    );

    return response.data;
};

export const getMyDeliveries = async () => {
    const response = await api.get(
        "/orders/my-deliveries",
        config()
    );

    return response.data;
};

export const acceptOrder = async (orderId) => {
    const response = await api.put(
        `/orders/${orderId}/accept`,
        {},
        config()
    );

    return response.data;
};

export const cancelOrder = async (orderId) => {
    const response = await api.put(
        `/orders/${orderId}/cancel`,
        {},
        config()
    );

    return response.data;
};

export const rejectOrder = async (orderId) => {
    const response = await api.put(
        `/orders/${orderId}/reject`,
        {},
        config()
    );

    return response.data;
};

export const updateOrderStatus = async (orderId, estado) => {
    const response = await api.put(
        `/orders/${orderId}/status`,
        { estado },
        config()
    );

    return response.data;
};

export const confirmRealTotal = async (orderId, totalReal) => {
    const response = await api.put(
        `/orders/${orderId}/confirm-total`,
        { total_real: Number(totalReal) },
        config()
    );

    return response.data;
};

export const confirmDelivery = async (orderId, observacionEntrega) => {
    const response = await api.put(
        `/orders/${orderId}/confirmar-entrega`,
        { observacion_entrega: observacionEntrega },
        config()
    );

    return response.data;
};

// =========================
// ADMIN
// =========================

export const getAllOrdersAdmin = async () => {
    const response = await api.get(
        "/orders/all",
        config()
    );

    return response.data;
};

export const reactivateCancelledOrder = async (orderId, repartidorId) => {
    const response = await api.put(
        `/orders/${orderId}/reactivar`,
        { repartidor_id: repartidorId },
        config()
    );

    return response.data;
};
