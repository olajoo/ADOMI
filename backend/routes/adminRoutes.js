const express = require("express");

const router = express.Router();

const adminController = require("../controllers/adminController");

const {
    verifyToken,
    isAdmin
} = require("../middleware/authMiddleware");

router.get(
    "/usuarios",
    verifyToken,
    isAdmin,
    adminController.getAllUsers
);

router.get(
    "/clientes",
    verifyToken,
    isAdmin,
    adminController.getClients
);

router.get(
    "/repartidores",
    verifyToken,
    isAdmin,
    adminController.getDeliveryUsers
);

router.put(
    "/usuarios/:id/estado",
    verifyToken,
    isAdmin,
    adminController.updateUserStatus
);

router.get(
    "/dashboard",
    verifyToken,
    isAdmin,
    adminController.getDashboardStats
);


// ======================================================
// RESOLVER INCIDENCIA DE PEDIDO
// SOLO ADMIN
// ======================================================

router.patch(
    "/pedidos/:id/resolver-incidencia",
    verifyToken,
    isAdmin,
    adminController.resolveOrderIncident
);


// ======================================================
// CORREGIR PEDIDO CANCELADO
// SOLO ADMIN
// ======================================================

router.patch(
    "/pedidos/:id/corregir",
    verifyToken,
    isAdmin,
    adminController.correctCancelledOrder
);


router.post(
    "/administradores",
    verifyToken,
    isAdmin,
    adminController.createAdminUser
);


router.post(
    "/repartidores",
    verifyToken,
    isAdmin,
    adminController.createDeliveryUser
);

module.exports = router;