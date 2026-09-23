const jwt = require("jsonwebtoken");

const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({
            message: "Token requerido"
        });
    }

    const parts = authHeader.split(" ");

    if (
        parts.length !== 2 ||
        parts[0] !== "Bearer" ||
        !parts[1]
    ) {
        return res.status(401).json({
            message: "Formato de token inválido"
        });
    }

    const token = parts[1];

    try {
        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        req.user = decoded;

        next();

    } catch (error) {
        return res.status(401).json({
            message: "Token inválido o expirado"
        });
    }
};

const isCliente = (req, res, next) => {
    if (req.user.rol !== "cliente") {
        return res.status(403).json({
            message: "Acceso permitido solo para clientes"
        });
    }

    next();
};

const isRepartidor = (req, res, next) => {
    if (req.user.rol !== "repartidor") {
        return res.status(403).json({
            message: "Acceso permitido solo para repartidores"
        });
    }

    next();
};

const isAdmin = (req, res, next) => {
    if (req.user.rol !== "admin") {
        return res.status(403).json({
            message: "Acceso permitido solo para administradores"
        });
    }

    next();
};

module.exports = {
    verifyToken,
    isCliente,
    isRepartidor,
    isAdmin
};