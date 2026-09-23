const mysql = require("mysql2");

require("dotenv").config();


// ==========================================
// VALIDAR VARIABLES DE ENTORNO
// ==========================================

const requiredEnv = [
    "MYSQLHOST",
    "MYSQLPORT",
    "MYSQLUSER",
    "MYSQLPASSWORD",
    "MYSQLDATABASE"
];

const missingEnv = requiredEnv.filter(
    (variable) => !process.env[variable]
);

if (missingEnv.length > 0) {

    console.error(
        "Faltan variables de entorno de MySQL:",
        missingEnv.join(", ")
    );

    process.exit(1);
}


// ==========================================
// POOL DE CONEXIONES MYSQL
// ==========================================

const pool = mysql.createPool({

    host: process.env.MYSQLHOST,

    port: Number(
        process.env.MYSQLPORT
    ),

    user: process.env.MYSQLUSER,

    password:
        process.env.MYSQLPASSWORD,

    database:
        process.env.MYSQLDATABASE,

    waitForConnections: true,

    connectionLimit: 10,

    queueLimit: 0,

    enableKeepAlive: true,

    keepAliveInitialDelay: 0

});


// ==========================================
// PROBAR CONEXIÓN
// ==========================================

pool.getConnection(
    (err, connection) => {

        if (err) {

            console.error(
                "Error al conectar con MySQL:",
                err.message
            );

            return;
        }

        console.log(
            "MySQL conectado correctamente"
        );

        connection.release();
    }
);


// ==========================================
// EXPORTAR POOL
// ==========================================

module.exports = pool;