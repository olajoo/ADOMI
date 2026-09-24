const db = require("../config/db");

const createUser = (
    nombre,
    correo,
    password,
    rol,
    callback
) => {
    const sql = `
        INSERT INTO usuarios
        (nombre, correo, password, rol)
        VALUES (?, ?, ?, ?)
    `;

    db.query(
        sql,
        [nombre, correo, password, rol],
        callback
    );
};

const findUserByEmail = (
    correo,
    callback
) => {
    const sql = `
        SELECT * FROM usuarios
        WHERE correo = ?
    `;

    db.query(sql, [correo], callback);
};

const saveResetPasswordToken = (
    userId,
    tokenHash,
    expires,
    callback
) => {
    const sql = `
        UPDATE usuarios
        SET reset_password_token = ?,
            reset_password_expires = DATE_ADD(NOW(), INTERVAL 15 MINUTE)
        WHERE id = ?
    `;

    db.query(
        sql,
        [tokenHash, userId],
        callback
    );
};

const findUserByValidResetToken = (
    tokenHash,
    callback
) => {
    const sql = `
        SELECT *
        FROM usuarios
        WHERE reset_password_token = ?
          AND reset_password_expires > NOW()
          AND estado = 'activo'
        LIMIT 1
    `;

    db.query(sql, [tokenHash], callback);
};

const updatePasswordAndClearResetToken = (
    userId,
    hashedPassword,
    callback
) => {
    const sql = `
        UPDATE usuarios
        SET password = ?,
            reset_password_token = NULL,
            reset_password_expires = NULL
        WHERE id = ?
    `;

    db.query(
        sql,
        [hashedPassword, userId],
        callback
    );
};

const clearResetPasswordToken = (
    userId,
    callback
) => {
    const sql = `
        UPDATE usuarios
        SET reset_password_token = NULL,
            reset_password_expires = NULL
        WHERE id = ?
    `;

    db.query(sql, [userId], callback);
};

module.exports = {
    createUser,
    findUserByEmail,
    saveResetPasswordToken,
    findUserByValidResetToken,
    updatePasswordAndClearResetToken,
    clearResetPasswordToken
};
