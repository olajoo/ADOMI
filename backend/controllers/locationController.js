const locationModel = require("../models/locationModel");
const orderModel = require("../models/orderModel");

const idValido = (valor) => {
    const id = Number(valor);

    return Number.isInteger(id) && id > 0;
};

const coordenadaValida = (valor, minimo, maximo) => {
    const numero = Number(valor);

    return (
        Number.isFinite(numero) &&
        numero >= minimo &&
        numero <= maximo
    );
};

const updateMyLocation = (req, res) => {
    const repartidorId = Number(req.user.id);
    const { latitud, longitud } = req.body || {};

    if (
        !coordenadaValida(latitud, -90, 90) ||
        !coordenadaValida(longitud, -180, 180)
    ) {
        return res.status(400).json({
            message: "Latitud o longitud no válida"
        });
    }

    locationModel.saveLocation(
        repartidorId,
        Number(latitud),
        Number(longitud),
        (err) => {
            if (err) {
                console.error(
                    "Error al guardar ubicación:",
                    err
                );

                return res.status(500).json({
                    message: "Error al guardar ubicación"
                });
            }

            return res.json({
                message:
                    "Ubicación actualizada correctamente",
                ubicacion: {
                    repartidor_id: repartidorId,
                    latitud: Number(latitud),
                    longitud: Number(longitud)
                }
            });
        }
    );
};

const getDeliveryLocation = (req, res) => {
    const repartidorId =
        Number(req.params.repartidorId);

    const usuarioId =
        Number(req.user.id);

    const rol =
        req.user.rol;

    if (!idValido(repartidorId)) {
        return res.status(400).json({
            message: "ID de repartidor no válido"
        });
    }

    const obtenerUbicacion = () => {
        locationModel.getLocationByDelivery(
            repartidorId,
            (err, results) => {
                if (err) {
                    console.error(
                        "Error al obtener ubicación:",
                        err
                    );

                    return res.status(500).json({
                        message:
                            "Error al obtener ubicación"
                    });
                }

                if (results.length === 0) {
                    return res.status(404).json({
                        message:
                            "Ubicación no disponible"
                    });
                }

                return res.json({
                    message:
                        "Ubicación obtenida correctamente",
                    ubicacion:
                        results[0]
                });
            }
        );
    };

    /*
     * El administrador puede consultar la ubicación
     * de cualquier repartidor.
     */
    if (rol === "admin") {
        return obtenerUbicacion();
    }

    /*
     * Un repartidor solamente puede consultar
     * su propia ubicación.
     */
    if (rol === "repartidor") {
        if (usuarioId !== repartidorId) {
            return res.status(403).json({
                message:
                    "No tiene permiso para consultar esta ubicación"
            });
        }

        return obtenerUbicacion();
    }

    /*
     * Para clientes comprobamos que exista al menos
     * un pedido activo del cliente asignado a ese
     * repartidor.
     *
     * Se utilizan los pedidos del propio cliente para
     * no exponer pedidos de otros usuarios.
     */
    if (rol === "cliente") {
        return orderModel.getOrdersByClient(
            usuarioId,
            (err, pedidos) => {
                if (err) {
                    console.error(
                        "Error verificando acceso a ubicación:",
                        err
                    );

                    return res.status(500).json({
                        message:
                            "Error al verificar acceso a la ubicación"
                    });
                }

                const tienePedidoActivo =
                    pedidos.some(
                        (pedido) =>
                            Number(
                                pedido.repartidor_id
                            ) === repartidorId &&
                            (
                                pedido.estado ===
                                    "aceptado" ||
                                pedido.estado ===
                                    "en camino"
                            )
                    );

                if (!tienePedidoActivo) {
                    return res.status(403).json({
                        message:
                            "No tiene un pedido activo con este repartidor"
                    });
                }

                return obtenerUbicacion();
            }
        );
    }

    return res.status(403).json({
        message:
            "No tiene permiso para consultar esta ubicación"
    });
};

module.exports = {
    updateMyLocation,
    getDeliveryLocation
};
