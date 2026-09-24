import api from "../api/api";

export const loginUser = async (correo, password) => {
    const response = await api.post("/auth/login", {
        correo,
        password
    });

    return response.data;
};

export const registerUser = async (nombre, correo, password, rol) => {
    const response = await api.post("/auth/register", {
        nombre,
        correo,
        password,
        rol
    });

    return response.data;
};

export const forgotPassword = async (correo) => {
    const response = await api.post("/auth/forgot-password", {
        correo
    });

    return response.data;
};

export const resetPassword = async (token, password) => {
    const response = await api.post("/auth/reset-password", {
        token,
        password
    });

    return response.data;
};
