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

export const getDashboardStats = async () => {
    const response = await api.get(
        "/admin/dashboard",
        config()
    );

    return response.data;
};

export const getAllUsers = async () => {
    const response = await api.get(
        "/admin/usuarios",
        config()
    );

    return response.data;
};

export const getClients = async () => {
    const response = await api.get(
        "/admin/clientes",
        config()
    );

    return response.data;
};

export const getDeliveryUsers = async () => {
    const response = await api.get(
        "/admin/repartidores",
        config()
    );

    return response.data;
};

export const updateUserStatus = async (userId, estado) => {
    const response = await api.put(
        `/admin/usuarios/${userId}/estado`,
        { estado },
        config()
    );

    return response.data;
};

export const createDeliveryUser = async (
    nombre,
    correo,
    password
) => {
    const response = await api.post(
        "/admin/repartidores",
        {
            nombre,
            correo,
            password
        },
        config()
    );

    return response.data;
};



export const getAllOrdersAdmin = async () => {
    const response = await api.get(
        "/orders",
        config()
    );

    return response.data;
};



export const resolveOrderIncident = async (
    pedidoId,
    resolucion
) => {
    const response = await api.patch(
        `/admin/pedidos/${pedidoId}/resolver-incidencia`,
        {
            resolucion
        },
        config()
    );

    return response.data;
};

export const correctCancelledOrder = async (
    pedidoId,
    datos
) => {
    const response = await api.patch(
        `/admin/pedidos/${pedidoId}/corregir`,
        datos,
        config()
    );

    return response.data;
};

export const createAdminUser = async (
    nombre,
    correo,
    password
) => {
    const response = await api.post(
        "/admin/administradores",
        {
            nombre,
            correo,
            password
        },
        config()
    );

    return response.data;
};

export const getReports = async (
    fechaInicio,
    fechaFin
) => {
    const response = await api.get(
        "/admin/reportes",
        {
            ...config(),
            params: {
                fecha_inicio: fechaInicio,
                fecha_fin: fechaFin
            }
        }
    );

    return response.data;
};