const express = require("express");

const router = express.Router();

const orderController = require("../controllers/orderController");

const {
    verifyToken,
    isCliente,
    isRepartidor,
    isAdmin
} = require("../middleware/authMiddleware");


// =========================
// CLIENTE
// =========================

router.post(
    "/",
    verifyToken,
    isCliente,
    orderController.createOrder
);

router.get(
    "/my-orders",
    verifyToken,
    isCliente,
    orderController.getMyOrders
);

// Compatibilidad
router.get(
    "/mis-pedidos",
    verifyToken,
    isCliente,
    orderController.getMyOrders
);

router.put(
    "/:id/confirmar-recepcion",
    verifyToken,
    isCliente,
    orderController.confirmClientReception
);


// =========================
// REPARTIDOR
// =========================

router.get(
    "/pending",
    verifyToken,
    isRepartidor,
    orderController.getPendingOrders
);

// Compatibilidad
router.get(
    "/pendientes",
    verifyToken,
    isRepartidor,
    orderController.getPendingOrders
);

router.get(
    "/my-deliveries",
    verifyToken,
    isRepartidor,
    orderController.getMyDeliveries
);

// Compatibilidad
router.get(
    "/mis-entregas",
    verifyToken,
    isRepartidor,
    orderController.getMyDeliveries
);

router.put(
    "/:id/accept",
    verifyToken,
    isRepartidor,
    orderController.acceptOrder
);

// Compatibilidad
router.put(
    "/:id/aceptar",
    verifyToken,
    isRepartidor,
    orderController.acceptOrder
);

router.put(
    "/:id/reject",
    verifyToken,
    isRepartidor,
    orderController.rejectOrder
);

router.put(
    "/:id/cancel",
    verifyToken,
    isRepartidor,
    orderController.cancelOrder
);

// Compatibilidad
router.put(
    "/:id/rechazar",
    verifyToken,
    isRepartidor,
    orderController.rejectOrder
);

router.put(
    "/:id/status",
    verifyToken,
    isRepartidor,
    orderController.updateOrderStatus
);

// Compatibilidad
router.put(
    "/:id/estado",
    verifyToken,
    isRepartidor,
    orderController.updateOrderStatus
);

router.put(
    "/:id/confirm-total",
    verifyToken,
    isRepartidor,
    orderController.confirmRealTotal
);

// Compatibilidad
router.put(
    "/:id/confirmar-total",
    verifyToken,
    isRepartidor,
    orderController.confirmRealTotal
);

router.put(
    "/:id/confirmar-entrega",
    verifyToken,
    isRepartidor,
    orderController.confirmDelivery
);


// =========================
// ADMIN
// =========================

// Obtener todos los pedidos
router.get(
    "/all",
    verifyToken,
    isAdmin,
    orderController.getAllOrders
);

// Compatibilidad
router.get(
    "/",
    verifyToken,
    isAdmin,
    orderController.getAllOrders
);

// Reactivar pedido cancelado
router.put(
    "/:id/reactivar",
    verifyToken,
    isAdmin,
    orderController.reactivateCancelledOrder
);


// =========================
// HISTORIAL
// =========================

router.get(
    "/:id/history",
    verifyToken,
    orderController.getOrderHistory
);

// Compatibilidad
router.get(
    "/:id/historial",
    verifyToken,
    orderController.getOrderHistory
);

module.exports = router;