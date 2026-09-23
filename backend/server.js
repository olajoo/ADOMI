const express = require("express");
const cors = require("cors");
const http = require("http");
const jwt = require("jsonwebtoken");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { Server } = require("socket.io");

require("dotenv").config();
require("./config/db");

const authRoutes = require("./routes/authRoutes");
const testRoutes = require("./routes/testRoutes");
const orderRoutes = require("./routes/orderRoutes");
const adminRoutes = require("./routes/adminRoutes");
const locationRoutes = require("./routes/locationRoutes");
const messageRoutes = require("./routes/messageRoutes");

const orderModel = require("./models/orderModel");


// ==========================================
// APP
// ==========================================

const app = express();

if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
}

const server = http.createServer(app);


// ==========================================
// CONFIGURACIÓN CORS
// ==========================================

const allowedOrigins = (
    process.env.FRONTEND_ORIGINS || ""
)
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

const corsOptions = {

    origin: (origin, callback) => {

        // Permite peticiones sin Origin
        // Ejemplo: Postman o aplicaciones móviles
        if (!origin) {
            return callback(null, true);
        }

        // Verificar si el origen está permitido
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        console.log(
            `Origen bloqueado por CORS: ${origin}`
        );

        return callback(
            new Error(
                "Origen no permitido por CORS"
            )
        );
    },

    credentials: true,

    methods: [
        "GET",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
        "OPTIONS"
    ],

    allowedHeaders: [
        "Content-Type",
        "Authorization"
    ]
};


// ==========================================
// SEGURIDAD HTTP - HELMET
// ==========================================

app.use(
    helmet({
        crossOriginResourcePolicy: false
    })
);


// ==========================================
// CORS
// ==========================================

app.use(
    cors(corsOptions)
);


// ==========================================
// PARSEO DE DATOS
// ==========================================

app.use(
    express.json({
        limit: "1mb"
    })
);

app.use(
    express.urlencoded({
        extended: true,
        limit: "1mb"
    })
);


// ==========================================
// RATE LIMIT - AUTENTICACIÓN
// ==========================================

const authLimiter = rateLimit({

    // Ventana de 15 minutos
    windowMs:
        15 * 60 * 1000,

    // Máximo 50 peticiones por IP
    limit: 50,

    // Headers modernos
    standardHeaders: "draft-8",

    // Desactivar headers antiguos
    legacyHeaders: false,

    // Respuesta cuando se alcanza el límite
    message: {
        success: false,
        message:
            "Demasiados intentos. Espera unos minutos antes de volver a intentarlo."
    }
});


// ==========================================
// SOCKET.IO
// ==========================================

const io = new Server(
    server,
    {

        cors: {

            origin:
                allowedOrigins,

            methods: [
                "GET",
                "POST"
            ],

            credentials: true
        }
    }
);


// Hacer Socket.IO accesible
// desde los controladores
app.set(
    "io",
    io
);


// ==========================================
// AUTENTICACIÓN SOCKET.IO
// ==========================================

io.use(
    (socket, next) => {

        try {

            const token =
                socket.handshake
                    .auth?.token;


            // Token obligatorio
            if (!token) {

                return next(
                    new Error(
                        "Token requerido"
                    )
                );
            }


            // Verificar configuración
            if (
                !process.env.JWT_SECRET
            ) {

                console.error(
                    "JWT_SECRET no está configurado"
                );

                return next(
                    new Error(
                        "Error de configuración"
                    )
                );
            }


            // Verificar JWT
            const decoded =
                jwt.verify(
                    token,
                    process.env.JWT_SECRET
                );


            // Validar información
            // mínima del token
            if (
                !decoded?.id ||
                !decoded?.rol
            ) {

                return next(
                    new Error(
                        "Token inválido"
                    )
                );
            }


            // Guardar usuario
            // dentro del socket
            socket.user = {

                id: Number(
                    decoded.id
                ),

                rol:
                    decoded.rol
            };


            return next();

        } catch (error) {

            return next(
                new Error(
                    "Token inválido o expirado"
                )
            );
        }
    }
);


// ==========================================
// EVENTOS SOCKET.IO
// ==========================================

io.on(
    "connection",
    (socket) => {

        console.log(
            `Usuario ${socket.user.id} (${socket.user.rol}) conectado: ${socket.id}`
        );


        // ==================================
        // UNIR USUARIO A SALA DE PEDIDO
        // ==================================

        socket.on(
            "joinOrderRoom",
            (pedidoId) => {

                const id =
                    Number(
                        pedidoId
                    );


                // Validar ID
                if (
                    !Number.isInteger(id) ||
                    id <= 0
                ) {

                    console.log(
                        `ID de pedido inválido recibido por socket ${socket.id}`
                    );

                    return;
                }


                // Buscar pedido
                orderModel.getOrderById(
                    id,
                    (err, results) => {

                        if (err) {

                            console.error(
                                "Error verificando acceso al pedido:",
                                err
                            );

                            return;
                        }


                        // Pedido no encontrado
                        if (
                            !results ||
                            results.length === 0
                        ) {

                            console.log(
                                `Pedido ${id} no encontrado`
                            );

                            return;
                        }


                        const pedido =
                            results[0];

                        const usuarioId =
                            Number(
                                socket.user.id
                            );

                        const rol =
                            socket.user.rol;


                        // ==========================
                        // PERMISOS
                        // ==========================

                        // Administrador
                        // puede supervisar pedidos
                        const esAdmin =
                            rol === "admin";


                        // Cliente solamente
                        // puede entrar a sus pedidos
                        const esCliente =
                            rol === "cliente" &&
                            Number(
                                pedido.cliente_id
                            ) === usuarioId;


                        // Repartidor solamente
                        // puede entrar a pedidos
                        // asignados a él
                        const esRepartidor =
                            rol === "repartidor" &&
                            pedido.repartidor_id !==
                                null &&
                            Number(
                                pedido.repartidor_id
                            ) === usuarioId;


                        // ==========================
                        // DENEGAR ACCESO
                        // ==========================

                        if (
                            !esAdmin &&
                            !esCliente &&
                            !esRepartidor
                        ) {

                            console.log(
                                `Acceso rechazado: usuario ${usuarioId} (${rol}) intentó entrar al pedido ${id}`
                            );

                            return;
                        }


                        // ==========================
                        // UNIR A SALA
                        // ==========================

                        const room =
                            `pedido_${id}`;

                        socket.join(
                            room
                        );


                        console.log(
                            `Usuario ${usuarioId} (${rol}) unido al pedido ${id}`
                        );
                    }
                );
            }
        );


        // ==================================
        // DESCONECTAR
        // ==================================

        socket.on(
            "disconnect",
            (reason) => {

                console.log(
                    `Usuario ${socket.user.id} desconectado: ${socket.id} - ${reason}`
                );
            }
        );
    }
);


// ==========================================
// RUTAS API
// ==========================================


// AUTENTICACIÓN
// Tiene protección contra exceso de intentos
app.use(
    "/api/auth",
    authLimiter,
    authRoutes
);


// RUTAS DE PRUEBA
app.use(
    "/api/test",
    testRoutes
);


// PEDIDOS
app.use(
    "/api/orders",
    orderRoutes
);


// ADMINISTRACIÓN
app.use(
    "/api/admin",
    adminRoutes
);


// UBICACIONES GPS
app.use(
    "/api/locations",
    locationRoutes
);


// CHAT
app.use(
    "/api/messages",
    messageRoutes
);


// ==========================================
// RUTA PRINCIPAL
// ==========================================

app.get(
    "/",
    (req, res) => {

        return res
            .status(200)
            .json({

                success: true,

                message:
                    "Servidor ADOMI funcionando"
            });
    }
);


// ==========================================
// RUTA API DE PRUEBA
// ==========================================

app.get(
    "/api",
    (req, res) => {

        return res
            .status(200)
            .json({

                success: true,

                message:
                    "API ADOMI funcionando correctamente"
            });
    }
);


// ==========================================
// RUTA NO ENCONTRADA
// ==========================================

app.use(
    (req, res) => {

        return res
            .status(404)
            .json({

                success: false,

                message:
                    "Ruta no encontrada"
            });
    }
);


// ==========================================
// MANEJO GLOBAL DE ERRORES
// ==========================================

app.use(
    (err, req, res, next) => {

        console.error(
            "Error del servidor:",
            err.message
        );


        // Error de CORS
        if (
            err.message ===
            "Origen no permitido por CORS"
        ) {

            return res
                .status(403)
                .json({

                    success: false,

                    message:
                        "El origen de la petición no está permitido"
                });
        }


        // Error general
        return res
            .status(500)
            .json({

                success: false,

                message:
                    "Ocurrió un error interno en el servidor"
            });
    }
);


// ==========================================
// SERVIDOR
// ==========================================

const PORT =
    process.env.PORT ||
    3000;


server.listen(
    PORT,
    () => {

        console.log("");

        console.log(
            "=============================="
        );

        console.log(
            "       ADOMI BACKEND"
        );

        console.log(
            "=============================="
        );


        console.log(
            `Servidor corriendo en puerto ${PORT}`
        );


        console.log(
            `Entorno: ${
                process.env.NODE_ENV ||
                "development"
            }`
        );


        console.log(
            `Orígenes permitidos: ${
                allowedOrigins.length
                    ? allowedOrigins.join(
                        ", "
                    )
                    : "Ninguno configurado"
            }`
        );


        console.log(
            "Helmet activado"
        );


        console.log(
            "Rate limit de autenticación activado"
        );


        console.log(
            "Socket.IO protegido con JWT"
        );


        console.log(
            "=============================="
        );

        console.log("");
    }
);