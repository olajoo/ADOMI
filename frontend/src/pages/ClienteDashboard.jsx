import { useEffect, useRef, useState } from "react";

import {
    createOrder,
    getMyOrders,
    getOrderHistory,
    confirmClientReception,
    cancelClientOrder
} from "../services/orderService";

import { getDeliveryLocation } from "../services/locationService";

import DeliveryMap from "../components/DeliveryMap";
import OrderChat from "../components/OrderChat";
import socket from "../socket";
import "./ClienteDashboard.css";

function ClienteDashboard() {
    const user = JSON.parse(localStorage.getItem("user"));
    const joinedOrderRoomsRef = useRef(new Set());

    const [vista, setVista] = useState("crear");

    const [tipoServicio, setTipoServicio] = useState("restaurante");
    const [lugarCompra, setLugarCompra] = useState("");
    const [descripcion, setDescripcion] = useState("");
    const [direccion, setDireccion] = useState("");
    const [telefonoContacto, setTelefonoContacto] = useState("");
    const [total, setTotal] = useState("");

    const [ubicacionCliente, setUbicacionCliente] = useState(null);
    const [ubicacionConfirmada, setUbicacionConfirmada] = useState(false);
    const [obteniendoUbicacion, setObteniendoUbicacion] = useState(false);
    const [precisionUbicacion, setPrecisionUbicacion] = useState(null);

    const [pedidos, setPedidos] = useState([]);
    const [historial, setHistorial] = useState([]);

    const [pedidoActivoSeleccionado, setPedidoActivoSeleccionado] =
        useState(null);

    const [pedidoHistorialSeleccionado, setPedidoHistorialSeleccionado] =
        useState(null);

    const [ubicacionRepartidor, setUbicacionRepartidor] = useState(null);

    const [comentariosCliente, setComentariosCliente] = useState({});

    const [mensaje, setMensaje] = useState("");
    const [error, setError] = useState("");
    const [notificacion, setNotificacion] = useState("");
    const [cargando, setCargando] = useState(false);
    const [panelPedido, setPanelPedido] = useState(null);
    const [pedidoCancelar, setPedidoCancelar] = useState(null);
    const [motivoCancelacion, setMotivoCancelacion] = useState("");
    const [cancelandoPedido, setCancelandoPedido] = useState(false);

    const pedidosActivos = pedidos.filter(
        (pedido) =>
            pedido.estado === "pendiente" ||
            pedido.estado === "aceptado" ||
            pedido.estado === "en camino" ||
            (
                pedido.estado === "entregado" &&
                !pedido.confirmacion_cliente
            )
    );

    const pedidosFinalizados = pedidos.filter(
        (pedido) =>
            pedido.estado === "cancelado" ||
            (
                pedido.estado === "entregado" &&
                Boolean(pedido.confirmacion_cliente)
            )
    );

    const cargarPedidos = async () => {
        try {
            const data = await getMyOrders();
            const nuevosPedidos = data.pedidos || [];

            setPedidos(nuevosPedidos);

            if (pedidoActivoSeleccionado) {
                const actualizado = nuevosPedidos.find(
                    (p) => p.id === pedidoActivoSeleccionado.id
                );

                if (actualizado) {
                    if (actualizado.estado === "cancelado") {
                        setPedidoActivoSeleccionado(null);
                        setPedidoHistorialSeleccionado(actualizado);
                        setVista("historial");

                        await cargarHistorial(actualizado.id);
                    } else if (
                        actualizado.estado === "entregado" &&
                        actualizado.confirmacion_cliente
                    ) {
                        setPedidoActivoSeleccionado(null);
                        setPedidoHistorialSeleccionado(actualizado);
                        setVista("historial");

                        await cargarHistorial(actualizado.id);
                    } else {
                        setPedidoActivoSeleccionado(actualizado);
                    }
                }
            }

            if (pedidoHistorialSeleccionado) {
                const actualizado = nuevosPedidos.find(
                    (p) => p.id === pedidoHistorialSeleccionado.id
                );

                if (actualizado) {
                    setPedidoHistorialSeleccionado(actualizado);
                }
            }
        } catch (error) {
            console.error(error);
            setError("No se pudieron cargar los pedidos");
        }
    };

    const cargarHistorial = async (pedidoId) => {
        try {
            const data = await getOrderHistory(pedidoId);

            setHistorial(data.historial || []);
        } catch (error) {
            console.error(error);
            setError("No se pudo cargar el historial");
        }
    };

    const cargarUbicacion = async (repartidorId) => {
        try {
            const data = await getDeliveryLocation(repartidorId);

            setUbicacionRepartidor(data.ubicacion);
        } catch (error) {
            console.error(error);
            setUbicacionRepartidor(null);
        }
    };

    useEffect(() => {
        cargarPedidos();

        const interval = setInterval(() => {
            cargarPedidos();
        }, 5000);

        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const joinRooms = () => {
            pedidos.forEach((pedido) => {
                if (!joinedOrderRoomsRef.current.has(pedido.id)) {
                    socket.emit("joinOrderRoom", pedido.id);
                    joinedOrderRoomsRef.current.add(pedido.id);
                }
            });
        };

        const handleReconnect = () => {
            joinedOrderRoomsRef.current.clear();
            joinRooms();
        };

        joinRooms();
        socket.on("connect", handleReconnect);

        return () => {
            socket.off("connect", handleReconnect);
        };
    }, [pedidos]);

    useEffect(() => {
        socket.on("pedidoActualizado", (pedidoActualizado) => {
            setPedidos((prevPedidos) =>
                prevPedidos.map((pedido) =>
                    pedido.id === pedidoActualizado.id
                        ? {
                              ...pedido,
                              ...pedidoActualizado
                          }
                        : pedido
                )
            );

            if (
                pedidoActivoSeleccionado &&
                pedidoActivoSeleccionado.id === pedidoActualizado.id
            ) {
                const pedidoNuevo = {
                    ...pedidoActivoSeleccionado,
                    ...pedidoActualizado
                };

                if (pedidoNuevo.estado === "cancelado") {
                    setPedidoActivoSeleccionado(null);
                    setPedidoHistorialSeleccionado(pedidoNuevo);
                    setVista("historial");
                    cargarHistorial(pedidoNuevo.id);
                } else if (
                    pedidoNuevo.estado === "entregado" &&
                    pedidoNuevo.confirmacion_cliente
                ) {
                    setPedidoActivoSeleccionado(null);
                    setPedidoHistorialSeleccionado(pedidoNuevo);
                    setVista("historial");
                    cargarHistorial(pedidoNuevo.id);
                } else {
                    setPedidoActivoSeleccionado(pedidoNuevo);
                }
            }

            if (
                pedidoHistorialSeleccionado &&
                pedidoHistorialSeleccionado.id === pedidoActualizado.id
            ) {
                const pedidoNuevo = {
                    ...pedidoHistorialSeleccionado,
                    ...pedidoActualizado
                };

                setPedidoHistorialSeleccionado(pedidoNuevo);

                cargarHistorial(pedidoNuevo.id);
            }

            setNotificacion(
                `Pedido #${pedidoActualizado.id} actualizado`
            );

            setTimeout(() => {
                setNotificacion("");
            }, 4000);
        });

        return () => {
            socket.off("pedidoActualizado");
        };
    }, [
        pedidoActivoSeleccionado,
        pedidoHistorialSeleccionado
    ]);

    useEffect(() => {
        if (!pedidoActivoSeleccionado?.repartidor_id) {
            return;
        }

        if (
            pedidoActivoSeleccionado.estado === "entregado" ||
            pedidoActivoSeleccionado.estado === "cancelado"
        ) {
            return;
        }

        cargarUbicacion(
            pedidoActivoSeleccionado.repartidor_id
        );

        const interval = setInterval(() => {
            cargarUbicacion(
                pedidoActivoSeleccionado.repartidor_id
            );
        }, 5000);

        return () => clearInterval(interval);
    }, [pedidoActivoSeleccionado]);

    const obtenerUbicacionCliente = () => {
        setError("");
        setMensaje("");

        if (!navigator.geolocation) {
            setError("Este dispositivo o navegador no permite obtener la ubicación.");
            return;
        }

        setObteniendoUbicacion(true);
        setUbicacionConfirmada(false);

        navigator.geolocation.getCurrentPosition(
            (position) => {
                setUbicacionCliente({
                    latitud: position.coords.latitude,
                    longitud: position.coords.longitude
                });
                setPrecisionUbicacion(Number.isFinite(position.coords.accuracy) ? Math.round(position.coords.accuracy) : null);
                setObteniendoUbicacion(false);
            },
            (geoError) => {
                console.error(geoError);
                setObteniendoUbicacion(false);
                if (geoError.code === 1) setError("Debes permitir el acceso a tu ubicación para indicar el punto exacto de entrega.");
                else if (geoError.code === 2) setError("No fue posible determinar tu ubicación. Activa el GPS e inténtalo nuevamente.");
                else if (geoError.code === 3) setError("La ubicación tardó demasiado en responder. Inténtalo nuevamente.");
                else setError("No se pudo obtener tu ubicación.");
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
    };

    const confirmarUbicacionCliente = () => {
        if (!ubicacionCliente) {
            setError("Primero debes obtener tu ubicación.");
            return;
        }
        setUbicacionConfirmada(true);
        setError("");
        setMensaje("Ubicación exacta de entrega confirmada.");
    };

    const handleCrearPedido = async (e) => {
        e.preventDefault();

        setMensaje("");
        setError("");

        const lugarCompraLimpio = lugarCompra.trim();
        const descripcionLimpia = descripcion.trim();
        const direccionLimpia = direccion.trim();
        const telefonoLimpio = telefonoContacto.replace(/\D/g, "");
        const totalNumero = Number(total);

        if (!lugarCompraLimpio) {
            setError(
                "Debe ingresar el nombre del restaurante o supermercado"
            );
            return;
        }

        if (lugarCompraLimpio.length > 150) {
            setError(
                "El lugar de compra no puede superar los 150 caracteres"
            );
            return;
        }

        if (!descripcionLimpia) {
            setError(
                "Debe ingresar la descripción del pedido"
            );
            return;
        }

        if (!direccionLimpia) {
            setError(
                "Debe ingresar la dirección de entrega"
            );
            return;
        }

        if (!/^\d{8}$/.test(telefonoLimpio)) {
            setError(
                "Debe ingresar un teléfono válido de 8 dígitos"
            );
            return;
        }

        if (
            total === "" ||
            !Number.isFinite(totalNumero)
        ) {
            setError(
                "Debe ingresar un total estimado válido"
            );
            return;
        }

        if (totalNumero <= 0) {
            setError(
                "El total estimado debe ser mayor que Q0.00"
            );
            return;
        }

        if (!ubicacionCliente || !ubicacionConfirmada) {
            setError("Debes compartir y confirmar la ubicación exacta de la entrega.");
            return;
        }

        setCargando(true);

        try {
            await createOrder({
                tipo_servicio: tipoServicio,
                lugar_compra: lugarCompraLimpio,
                descripcion: descripcionLimpia,
                direccion: direccionLimpia,
                telefono_contacto: telefonoLimpio,
                total: totalNumero,
                cliente_latitud: ubicacionCliente.latitud,
                cliente_longitud: ubicacionCliente.longitud
            });

            setMensaje(
                "Pedido creado correctamente"
            );

            setLugarCompra("");
            setDescripcion("");
            setDireccion("");
            setTelefonoContacto("");
            setTotal("");
            setTipoServicio("restaurante");
            setUbicacionCliente(null);
            setUbicacionConfirmada(false);
            setPrecisionUbicacion(null);

            await cargarPedidos();

            setVista("activo");
        } catch (error) {
            setError(
                error.response?.data?.message ||
                    "Error al crear pedido"
            );
        } finally {
            setCargando(false);
        }
    };

    const seleccionarPedidoActivo = async (pedido) => {
        setPedidoActivoSeleccionado(pedido);

        setUbicacionRepartidor(null);

        if (pedido.repartidor_id) {
            await cargarUbicacion(
                pedido.repartidor_id
            );
        }
    };

    const seleccionarPedidoHistorial = async (pedido) => {
        setPedidoHistorialSeleccionado(pedido);

        await cargarHistorial(pedido.id);
    };

    const handleConfirmarRecepcion = async (
        pedido,
        confirmacion
    ) => {
        setMensaje("");
        setError("");

        const comentario =
            comentariosCliente[pedido.id] || "";

        try {
            await confirmClientReception(
                pedido.id,
                confirmacion,
                comentario
            );

            const pedidoActualizado = {
                ...pedido,
                confirmacion_cliente: confirmacion,
                comentario_cliente: comentario,
                fecha_confirmacion_cliente:
                    new Date().toISOString()
            };

            setPedidoHistorialSeleccionado(
                pedidoActualizado
            );

            setPedidos((prevPedidos) =>
                prevPedidos.map((p) =>
                    p.id === pedido.id
                        ? pedidoActualizado
                        : p
                )
            );

            setMensaje(
                "Respuesta enviada correctamente"
            );

            setComentariosCliente({
                ...comentariosCliente,
                [pedido.id]: ""
            });

            await cargarPedidos();

            await cargarHistorial(pedido.id);

            setPedidoActivoSeleccionado(null);
            setPedidoHistorialSeleccionado(pedidoActualizado);
            setVista("historial");
        } catch (error) {
            setError(
                error.response?.data?.message ||
                    "Error al confirmar recepción"
            );
        }
    };

    const handleCancelarPedidoCliente = async () => {
        if (!pedidoCancelar) return;

        setMensaje("");
        setError("");
        setCancelandoPedido(true);

        try {
            await cancelClientOrder(
                pedidoCancelar.id,
                motivoCancelacion.trim()
            );

            setMensaje(`Pedido #${pedidoCancelar.id} cancelado correctamente`);
            setPedidoCancelar(null);
            setMotivoCancelacion("");
            setPedidoActivoSeleccionado(null);

            await cargarPedidos();
            await cargarHistorial(pedidoCancelar.id);

            setVista("historial");
        } catch (error) {
            setError(
                error.response?.data?.message ||
                    "No se pudo cancelar el pedido"
            );
        } finally {
            setCancelandoPedido(false);
        }
    };

    const cerrarSesion = () => {
        localStorage.clear();

        window.location.href = "/";
    };

    const getEstadoBadge = (estado) => {
        if (estado === "pendiente") {
            return "badge bg-secondary";
        }

        if (estado === "aceptado") {
            return "badge bg-primary";
        }

        if (estado === "en camino") {
            return "badge bg-warning text-dark";
        }

        if (estado === "entregado") {
            return "badge bg-success";
        }

        if (estado === "cancelado") {
            return "badge bg-danger";
        }

        return "badge bg-dark";
    };

    const getDiferencia = (diferencia) => {
        if (
            diferencia === null ||
            diferencia === undefined
        ) {
            return "Pendiente";
        }

        if (Number(diferencia) > 0) {
            return (
                <span className="text-danger fw-bold">
                    + Q {diferencia}
                </span>
            );
        }

        if (Number(diferencia) < 0) {
            return (
                <span className="text-success fw-bold">
                    Q {diferencia}
                </span>
            );
        }

        return (
            <span className="text-secondary fw-bold">
                Q 0.00
            </span>
        );
    };

    return (
        <div className="min-vh-100 bg-light adomi-client">

            <nav className="navbar navbar-expand-lg navbar-dark bg-primary shadow-sm adomi-client__navbar">
                <div className="container-fluid px-4">

                    <span className="navbar-brand fw-bold">
                        <i className="bi bi-bag-check me-2"></i>
                        ADOMI Cliente
                    </span>

                    <div className="d-flex align-items-center gap-3">

                        <span className="text-white d-none d-md-block">
                            {user?.nombre}
                        </span>

                        <button
                            className="btn btn-outline-light btn-sm"
                            onClick={cerrarSesion}
                        >
                            Cerrar sesión
                        </button>

                    </div>
                </div>
            </nav>

            <main className="container-fluid px-4 py-4 adomi-client__main">

                {notificacion && (
                    <div className="alert alert-info shadow-sm">
                        <i className="bi bi-bell me-2"></i>
                        {notificacion}
                    </div>
                )}

                {mensaje && (
                    <div className="alert alert-success">
                        {mensaje}
                    </div>
                )}

                {error && (
                    <div className="alert alert-danger">
                        {error}
                    </div>
                )}

                <div className="card border-0 shadow-sm rounded-4 mb-4">

                    <div className="card-body p-4">

                        <h2 className="fw-bold mb-1">
                            Hola, {user?.nombre}
                        </h2>

                        <p className="text-muted mb-0">
                            Crea pedidos, sigue tus envíos activos y confirma tus entregas.
                        </p>

                    </div>
                </div>

                <div className="row g-3 mb-4">

                    <div className="col-12 col-md-4">

                        <button
                            className={`card border-0 shadow-sm rounded-4 w-100 text-start adomi-client__nav-card ${
                                vista === "crear"
                                    ? "adomi-client__nav-card--active"
                                    : ""
                            }`}
                            onClick={() =>
                                setVista("crear")
                            }
                        >
                            <div className="card-body p-4">

                                <div className="fs-1 text-primary mb-2">
                                    <i className="bi bi-plus-circle"></i>
                                </div>

                                <h5 className="fw-bold">
                                    Crear pedido
                                </h5>

                                <p className="text-muted mb-0">
                                    Inicia un nuevo pedido.
                                </p>

                            </div>
                        </button>

                    </div>

                    <div className="col-12 col-md-4">

                        <button
                            className={`card border-0 shadow-sm rounded-4 w-100 text-start adomi-client__nav-card ${
                                vista === "activo"
                                    ? "adomi-client__nav-card--active"
                                    : ""
                            }`}
                            onClick={() =>
                                setVista("activo")
                            }
                        >
                            <div className="card-body p-4">

                                <div className="fs-1 text-warning mb-2">
                                    <i className="bi bi-truck"></i>
                                </div>

                                <h5 className="fw-bold">
                                    Pedido en curso
                                </h5>

                                <p className="text-muted mb-0">
                                    {pedidosActivos.length} pedido(s) activo(s).
                                </p>

                            </div>
                        </button>

                    </div>

                    <div className="col-12 col-md-4">

                        <button
                            className={`card border-0 shadow-sm rounded-4 w-100 text-start adomi-client__nav-card ${
                                vista === "historial"
                                    ? "adomi-client__nav-card--active"
                                    : ""
                            }`}
                            onClick={() =>
                                setVista("historial")
                            }
                        >
                            <div className="card-body p-4">

                                <div className="fs-1 text-success mb-2">
                                    <i className="bi bi-clock-history"></i>
                                </div>

                                <h5 className="fw-bold">
                                    Historial
                                </h5>

                                <p className="text-muted mb-0">
                                    {pedidosFinalizados.length} pedido(s) finalizado(s).
                                </p>

                            </div>
                        </button>

                    </div>

                </div>

                {vista === "crear" && (

                    <div className="row justify-content-center">

                        <div className="col-12 col-xl-7">

                            <div className="card border-0 shadow-sm rounded-4">

                                <div className="card-body p-4">

                                    <h4 className="fw-bold mb-3">
                                        <i className="bi bi-plus-circle me-2 text-primary"></i>
                                        Crear nuevo pedido
                                    </h4>

                                    <form onSubmit={handleCrearPedido}>

                                        <div className="mb-3">

                                            <label className="form-label fw-semibold">
                                                Tipo de servicio
                                            </label>

                                            <div className="adomi-service-selector">
                                                <button
                                                    type="button"
                                                    className={`adomi-service-option ${tipoServicio === "restaurante" ? "adomi-service-option--active" : ""}`}
                                                    onClick={() => setTipoServicio("restaurante")}
                                                >
                                                    <span className="adomi-service-option__icon"><i className="bi bi-shop-window"></i></span>
                                                    <span><strong>Restaurante</strong><small>Comida preparada</small></span>
                                                    <i className="bi bi-check-circle-fill adomi-service-option__check"></i>
                                                </button>

                                                <button
                                                    type="button"
                                                    className={`adomi-service-option ${tipoServicio === "supermercado" ? "adomi-service-option--active" : ""}`}
                                                    onClick={() => setTipoServicio("supermercado")}
                                                >
                                                    <span className="adomi-service-option__icon"><i className="bi bi-basket2"></i></span>
                                                    <span><strong>Abarrotes</strong><small>Supermercado / tienda</small></span>
                                                    <i className="bi bi-check-circle-fill adomi-service-option__check"></i>
                                                </button>
                                            </div>

                                        </div>

                                        <div className="mb-3">

                                            <label className="form-label fw-semibold">
                                                <i className="bi bi-shop me-2 text-primary"></i>
                                                Lugar de compra / recogida *
                                            </label>

                                            <input
                                                type="text"
                                                className="form-control"
                                                placeholder={
                                                    tipoServicio === "restaurante"
                                                        ? "Ejemplo: Pollo Campero Jalapa"
                                                        : "Ejemplo: Supermercado La Torre"
                                                }
                                                value={lugarCompra}
                                                maxLength="150"
                                                onChange={(e) =>
                                                    setLugarCompra(e.target.value)
                                                }
                                                required
                                            />

                                            <small className="text-muted">
                                                Escribe el nombre del restaurante o supermercado donde se recogerá el pedido.
                                            </small>

                                        </div>

                                        <div className="mb-3">

                                            <label className="form-label fw-semibold">
                                                Descripción
                                            </label>

                                            <textarea
                                                className="form-control"
                                                rows="4"
                                                placeholder="Ejemplo: 2 hamburguesas, 1 gaseosa..."
                                                value={descripcion}
                                                onChange={(e) =>
                                                    setDescripcion(
                                                        e.target.value
                                                    )
                                                }
                                                required
                                            ></textarea>

                                        </div>

                                        <div className="mb-3">

                                            <label className="form-label fw-semibold">
                                                Dirección
                                            </label>

                                            <input
                                                type="text"
                                                className="form-control"
                                                placeholder="Dirección de entrega"
                                                value={direccion}
                                                onChange={(e) =>
                                                    setDireccion(
                                                        e.target.value
                                                    )
                                                }
                                                required
                                            />

                                        </div>

                                        <div className="mb-3">

                                            <label className="form-label fw-semibold">
                                                <i className="bi bi-telephone me-2 text-success"></i>
                                                Teléfono de contacto *
                                            </label>

                                            <input
                                                type="tel"
                                                inputMode="numeric"
                                                className="form-control"
                                                placeholder="Ejemplo: 5555-5555"
                                                value={telefonoContacto}
                                                maxLength="9"
                                                onChange={(e) => {
                                                    const numeros = e.target.value
                                                        .replace(/\D/g, "")
                                                        .slice(0, 8);

                                                    const formateado =
                                                        numeros.length > 4
                                                            ? `${numeros.slice(0, 4)}-${numeros.slice(4)}`
                                                            : numeros;

                                                    setTelefonoContacto(formateado);
                                                }}
                                                required
                                            />

                                            <small className="text-muted">
                                                Se utilizará únicamente si el repartidor necesita comunicarse por una eventualidad con el pedido.
                                            </small>

                                        </div>

                                        <div className="mb-4">

                                            <label className="form-label fw-semibold">
                                                Total estimado
                                            </label>

                                            <div className="input-group">

                                                <span className="input-group-text">
                                                    Q
                                                </span>

                                                <input
                                                    type="number"
                                                    className="form-control"
                                                    placeholder="65.00"
                                                    value={total}
                                                    min="0.01"
                                                    step="0.01"
                                                    onChange={(e) => {
                                                        const valor =
                                                            e.target.value;

                                                        if (
                                                            valor === "" ||
                                                            Number(valor) >= 0
                                                        ) {
                                                            setTotal(valor);
                                                        }
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (
                                                            e.key === "-" ||
                                                            e.key === "e" ||
                                                            e.key === "E"
                                                        ) {
                                                            e.preventDefault();
                                                        }
                                                    }}
                                                    required
                                                />

                                            </div>

                                            <small className="text-muted">
                                                Ingresa un monto mayor a Q0.00.
                                            </small>

                                        </div>

                                        <div className="mb-4">
                                            <label className="form-label fw-semibold">
                                                <i className="bi bi-geo-alt-fill text-danger me-2"></i>
                                                Ubicación exacta de entrega
                                            </label>

                                            <div className="border rounded-4 p-3 bg-light">
                                                <p className="text-muted small mb-3">
                                                    Comparte el punto GPS donde deseas recibir el pedido. La dirección escrita seguirá sirviendo como referencia.
                                                </p>

                                                {!ubicacionCliente ? (
                                                    <button type="button" className="btn btn-outline-primary w-100" onClick={obtenerUbicacionCliente} disabled={obteniendoUbicacion}>
                                                        <i className="bi bi-crosshair me-2"></i>
                                                        {obteniendoUbicacion ? "Obteniendo ubicación..." : "Usar mi ubicación actual"}
                                                    </button>
                                                ) : (
                                                    <>
                                                        <DeliveryMap latitud={ubicacionCliente.latitud} longitud={ubicacionCliente.longitud} titulo="Punto de entrega" altura="260px" />

                                                        <div className={`alert ${ubicacionConfirmada ? "alert-success" : "alert-warning"} mt-3 mb-3`}>
                                                            {ubicacionConfirmada ? (
                                                                <><i className="bi bi-check-circle-fill me-2"></i>Ubicación de entrega confirmada.</>
                                                            ) : (
                                                                <><i className="bi bi-exclamation-triangle-fill me-2"></i>Revisa el mapa y confirma que este sea el lugar correcto.</>
                                                            )}
                                                            {precisionUbicacion !== null && <div className="small mt-1">Precisión aproximada del GPS: ± {precisionUbicacion} m</div>}
                                                        </div>

                                                        <div className="d-flex flex-column flex-md-row gap-2">
                                                            <button type="button" className="btn btn-outline-secondary flex-fill" onClick={obtenerUbicacionCliente} disabled={obteniendoUbicacion}>
                                                                <i className="bi bi-arrow-clockwise me-2"></i>
                                                                {obteniendoUbicacion ? "Actualizando..." : "Obtener nuevamente"}
                                                            </button>
                                                            <button type="button" className="btn btn-success flex-fill" onClick={confirmarUbicacionCliente} disabled={ubicacionConfirmada}>
                                                                <i className="bi bi-check-circle me-2"></i>
                                                                {ubicacionConfirmada ? "Ubicación confirmada" : "Confirmar esta ubicación"}
                                                            </button>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        <button
                                            type="submit"
                                            className="btn btn-primary w-100 py-2 fw-semibold"
                                            disabled={cargando || !ubicacionConfirmada}
                                        >
                                            {cargando
                                                ? "Creando..."
                                                : !ubicacionConfirmada
                                                ? "Confirma tu ubicación para continuar"
                                                : "Crear pedido"}
                                        </button>

                                    </form>

                                </div>
                            </div>

                        </div>

                    </div>
                )}

                {vista === "activo" && (

                    <div className="row g-4">

                        <div className="col-12 col-xl-5">

                            <div className="card border-0 shadow-sm rounded-4">

                                <div className="card-body p-4">

                                    <div className="d-flex justify-content-between align-items-center mb-3">

                                        <h4 className="fw-bold mb-0">
                                            Pedidos en curso
                                        </h4>

                                        <button
                                            className="btn btn-outline-primary btn-sm"
                                            onClick={cargarPedidos}
                                        >
                                            Actualizar
                                        </button>

                                    </div>

                                    {pedidosActivos.length === 0 ? (

                                        <p className="text-muted text-center py-4">
                                            No tienes pedidos activos.
                                        </p>

                                    ) : (

                                        pedidosActivos.map(
                                            (pedido) => (

                                                <button
                                                    key={pedido.id}
                                                    className={`card w-100 text-start border-0 shadow-sm rounded-4 mb-3 ${
                                                        pedidoActivoSeleccionado?.id ===
                                                        pedido.id
                                                            ? "border border-primary"
                                                            : ""
                                                    }`}
                                                    onClick={() =>
                                                        seleccionarPedidoActivo(
                                                            pedido
                                                        )
                                                    }
                                                >

                                                    <div className="card-body">

                                                        <div className="d-flex justify-content-between align-items-start">

                                                            <div>

                                                                <h5 className="fw-bold mb-1">
                                                                    Pedido #{pedido.id}
                                                                </h5>

                                                                <p className="text-muted mb-1 text-capitalize">
                                                                    {pedido.tipo_servicio}
                                                                </p>

                                                                {pedido.lugar_compra && (
                                                                    <div className="fw-semibold text-primary">
                                                                        <i className="bi bi-shop me-1"></i>
                                                                        {pedido.lugar_compra}
                                                                    </div>
                                                                )}

                                                            </div>

                                                            <span
                                                                className={getEstadoBadge(
                                                                    pedido.estado
                                                                )}
                                                            >
                                                                {pedido.estado}
                                                            </span>

                                                        </div>

                                                        <p className="mb-2">
                                                            {pedido.descripcion}
                                                        </p>

                                                        <small className="text-muted">
                                                            Total estimado: Q {pedido.total}
                                                        </small>

                                                    </div>

                                                </button>
                                            )
                                        )
                                    )}

                                </div>
                            </div>

                        </div>

                        <div className="col-12 col-xl-7">

                            {!pedidoActivoSeleccionado ? (

                                <div className="card border-0 shadow-sm rounded-4">

                                    <div className="card-body p-5 text-center">

                                        <i className="bi bi-truck fs-1 text-muted"></i>

                                        <p className="text-muted mt-3 mb-0">
                                            Selecciona un pedido en curso para ver mapa, chat y detalle.
                                        </p>

                                    </div>

                                </div>

                            ) : (

                                <>

                                    <div className="card border-0 shadow-sm rounded-4 mb-4">

                                        <div className="card-body p-4">

                                            <div className="d-flex justify-content-between align-items-start mb-3">

                                                <div>

                                                    <h4 className="fw-bold mb-1">
                                                        Pedido #{pedidoActivoSeleccionado.id}
                                                    </h4>

                                                    {pedidoActivoSeleccionado.lugar_compra && (
                                                        <h5 className="text-primary fw-bold mb-1">
                                                            <i className="bi bi-shop me-2"></i>
                                                            {pedidoActivoSeleccionado.lugar_compra}
                                                        </h5>
                                                    )}

                                                    <p className="text-muted mb-1">
                                                        {pedidoActivoSeleccionado.direccion}
                                                    </p>

                                                    {pedidoActivoSeleccionado.telefono_contacto && (
                                                        <p className="mb-0">
                                                            <i className="bi bi-telephone me-2 text-success"></i>
                                                            {pedidoActivoSeleccionado.telefono_contacto}
                                                        </p>
                                                    )}

                                                </div>

                                                <span
                                                    className={getEstadoBadge(
                                                        pedidoActivoSeleccionado.estado
                                                    )}
                                                >
                                                    {pedidoActivoSeleccionado.estado}
                                                </span>

                                            </div>

                                            <div className="row g-3">

                                                <div className="col-12 col-md-4">

                                                    <div className="bg-light rounded-4 p-3">

                                                        <small className="text-muted">
                                                            Estimado
                                                        </small>

                                                        <h5 className="fw-bold mb-0">
                                                            Q {pedidoActivoSeleccionado.total}
                                                        </h5>

                                                    </div>

                                                </div>

                                                <div className="col-12 col-md-4">

                                                    <div className="bg-light rounded-4 p-3">

                                                        <small className="text-muted">
                                                            Real
                                                        </small>

                                                        <h5 className="fw-bold mb-0">
                                                            {pedidoActivoSeleccionado.total_real !==
                                                                null &&
                                                            pedidoActivoSeleccionado.total_real !==
                                                                undefined
                                                                ? `Q ${pedidoActivoSeleccionado.total_real}`
                                                                : "Pendiente"}
                                                        </h5>

                                                    </div>

                                                </div>

                                                <div className="col-12 col-md-4">

                                                    <div className="bg-light rounded-4 p-3">

                                                        <small className="text-muted">
                                                            Diferencia
                                                        </small>

                                                        <h5 className="fw-bold mb-0">
                                                            {getDiferencia(
                                                                pedidoActivoSeleccionado.diferencia
                                                            )}
                                                        </h5>

                                                    </div>

                                                </div>

                                            </div>

                                        </div>

                                    </div>

                                    {pedidoActivoSeleccionado.estado === "entregado" &&
                                        !pedidoActivoSeleccionado.confirmacion_cliente && (

                                        <div className="card border-0 shadow-sm rounded-4 mb-4">

                                            <div className="card-body p-4">

                                                <div className="alert alert-success border-0 rounded-4">

                                                    <h5 className="fw-bold mb-2">
                                                        <i className="bi bi-box-seam me-2"></i>
                                                        El repartidor marcó el pedido como entregado
                                                    </h5>

                                                    <p className="mb-0">
                                                        Confirma si recibiste correctamente tu pedido o reporta si tuviste algún problema.
                                                    </p>

                                                </div>

                                                <textarea
                                                    className="form-control mb-3"
                                                    rows="3"
                                                    placeholder="Comentario opcional o describe el problema"
                                                    value={
                                                        comentariosCliente[
                                                            pedidoActivoSeleccionado.id
                                                        ] || ""
                                                    }
                                                    onChange={(e) =>
                                                        setComentariosCliente((prev) => ({
                                                            ...prev,
                                                            [pedidoActivoSeleccionado.id]:
                                                                e.target.value
                                                        }))
                                                    }
                                                />

                                                <div className="d-grid d-md-flex gap-2">

                                                    <button
                                                        type="button"
                                                        className="btn btn-success flex-fill"
                                                        onClick={() =>
                                                            handleConfirmarRecepcion(
                                                                pedidoActivoSeleccionado,
                                                                "confirmado"
                                                            )
                                                        }
                                                    >
                                                        <i className="bi bi-check-circle me-2"></i>
                                                        Sí, recibí mi pedido
                                                    </button>

                                                    <button
                                                        type="button"
                                                        className="btn btn-outline-danger flex-fill"
                                                        onClick={() =>
                                                            handleConfirmarRecepcion(
                                                                pedidoActivoSeleccionado,
                                                                "problema"
                                                            )
                                                        }
                                                    >
                                                        <i className="bi bi-exclamation-triangle me-2"></i>
                                                        Tuve un problema
                                                    </button>

                                                </div>

                                            </div>

                                        </div>

                                    )}


                                    {(pedidoActivoSeleccionado.estado === "pendiente" ||
                                        pedidoActivoSeleccionado.estado === "aceptado") && (
                                        <div className="card border-0 shadow-sm rounded-4 mb-3">
                                            <div className="card-body p-3 p-md-4 d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
                                                <div>
                                                    <h5 className="fw-bold mb-1">
                                                        <i className="bi bi-x-circle me-2 text-danger"></i>
                                                        ¿Ya no necesitas este pedido?
                                                    </h5>
                                                    <p className="text-muted small mb-0">
                                                        Puedes cancelarlo mientras aún no haya iniciado el recorrido de entrega.
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    className="btn btn-outline-danger flex-shrink-0"
                                                    onClick={() => {
                                                        setPedidoCancelar(pedidoActivoSeleccionado);
                                                        setMotivoCancelacion("");
                                                        setError("");
                                                    }}
                                                >
                                                    <i className="bi bi-x-circle me-2"></i>
                                                    Cancelar pedido
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    <div className="card border-0 shadow-sm rounded-4 adomi-client__tools-card">
                                        <div className="card-body p-3 p-md-4">
                                            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
                                                <div><h5 className="fw-bold mb-1">Seguimiento del pedido</h5><p className="text-muted small mb-0">Consulta la ubicación o conversa con el repartidor cuando lo necesites.</p></div>
                                                <div className="adomi-client__tools-actions">
                                                    <button type="button" className="btn btn-outline-success" disabled={!pedidoActivoSeleccionado.repartidor_id || !ubicacionRepartidor} onClick={() => setPanelPedido("mapa")}><i className="bi bi-map me-2"></i>Ver seguimiento</button>
                                                    <button type="button" className="btn btn-dark" disabled={!pedidoActivoSeleccionado.repartidor_id} onClick={() => setPanelPedido("chat")}><i className="bi bi-chat-dots me-2"></i>Abrir chat</button>
                                                </div>
                                            </div>
                                            {!pedidoActivoSeleccionado.repartidor_id && <small className="text-muted d-block mt-3">Disponible cuando un repartidor acepte el pedido.</small>}
                                        </div>
                                    </div>

                                </>
                            )}

                        </div>

                    </div>
                )}

                {vista === "historial" && (

                    <div className="row g-4">

                        <div className="col-12 col-xl-5">

                            <div className="card border-0 shadow-sm rounded-4">

                                <div className="card-body p-4">

                                    <h4 className="fw-bold mb-3">
                                        Historial de pedidos
                                    </h4>

                                    {pedidosFinalizados.length === 0 ? (

                                        <p className="text-muted text-center py-4">
                                            Aún no tienes pedidos finalizados.
                                        </p>

                                    ) : (

                                        pedidosFinalizados.map(
                                            (pedido) => (

                                                <button
                                                    key={pedido.id}
                                                    className={`card w-100 text-start border-0 shadow-sm rounded-4 mb-3 ${
                                                        pedidoHistorialSeleccionado?.id ===
                                                        pedido.id
                                                            ? "border border-success"
                                                            : ""
                                                    }`}
                                                    onClick={() =>
                                                        seleccionarPedidoHistorial(
                                                            pedido
                                                        )
                                                    }
                                                >

                                                    <div className="card-body">

                                                        <div className="d-flex justify-content-between align-items-start">

                                                            <div>

                                                                <h5 className="fw-bold mb-1">
                                                                    Pedido #{pedido.id}
                                                                </h5>

                                                                <p className="text-muted mb-1 text-capitalize">
                                                                    {pedido.tipo_servicio}
                                                                </p>

                                                            </div>

                                                            <span
                                                                className={getEstadoBadge(
                                                                    pedido.estado
                                                                )}
                                                            >
                                                                {pedido.estado}
                                                            </span>

                                                        </div>

                                                        <small className="text-muted">
                                                            Total: Q{" "}
                                                            {pedido.total_real ??
                                                                pedido.total}
                                                        </small>

                                                    </div>

                                                </button>
                                            )
                                        )
                                    )}

                                </div>

                            </div>

                        </div>

                        <div className="col-12 col-xl-7">

                            {!pedidoHistorialSeleccionado ? (

                                <div className="card border-0 shadow-sm rounded-4">

                                    <div className="card-body p-5 text-center">

                                        <i className="bi bi-receipt fs-1 text-muted"></i>

                                        <p className="text-muted mt-3 mb-0">
                                            Selecciona un pedido finalizado para confirmar recibido o reportar problema.
                                        </p>

                                    </div>

                                </div>

                            ) : (

                                <>

                                    <div className="card border-0 shadow-sm rounded-4 mb-4">

                                        <div className="card-body p-4">

                                            <h4 className="fw-bold mb-3">
                                                Comprobante de entrega
                                            </h4>

                                            {pedidoHistorialSeleccionado.estado ===
                                            "cancelado" ? (

                                                <div className="alert alert-danger mb-0">
                                                    Este pedido fue cancelado.
                                                </div>

                                            ) : (

                                                <>

                                                    <p className="mb-2">
                                                        <strong>
                                                            Pedido:
                                                        </strong>{" "}
                                                        #
                                                        {
                                                            pedidoHistorialSeleccionado.id
                                                        }
                                                    </p>

                                                    <p className="mb-2">
                                                        <strong>
                                                            Observación repartidor:
                                                        </strong>{" "}
                                                        {pedidoHistorialSeleccionado.observacion_entrega ||
                                                            "Sin observación"}
                                                    </p>

                                                    <p className="mb-3">
                                                        <strong>
                                                            Fecha entrega:
                                                        </strong>{" "}
                                                        {pedidoHistorialSeleccionado.fecha_entrega
                                                            ? new Date(
                                                                  pedidoHistorialSeleccionado.fecha_entrega
                                                              ).toLocaleString()
                                                            : "Sin fecha"}
                                                    </p>

                                                    {pedidoHistorialSeleccionado.confirmacion_cliente ? (

                                                        <div className="alert alert-info mb-0">

                                                            <p className="mb-2">

                                                                <strong>
                                                                    Respuesta enviada:
                                                                </strong>{" "}

                                                                {pedidoHistorialSeleccionado.confirmacion_cliente ===
                                                                "confirmado"
                                                                    ? "Pedido recibido correctamente"
                                                                    : "Problema reportado"}

                                                            </p>

                                                            {pedidoHistorialSeleccionado.comentario_cliente && (

                                                                <p className="mb-0">

                                                                    <strong>
                                                                        Comentario:
                                                                    </strong>{" "}

                                                                    {
                                                                        pedidoHistorialSeleccionado.comentario_cliente
                                                                    }

                                                                </p>
                                                            )}

                                                            {pedidoHistorialSeleccionado.fecha_confirmacion_cliente && (

                                                                <small className="text-muted">

                                                                    {new Date(
                                                                        pedidoHistorialSeleccionado.fecha_confirmacion_cliente
                                                                    ).toLocaleString()}

                                                                </small>
                                                            )}

                                                        </div>

                                                    ) : (

                                                        <>

                                                            <textarea
                                                                className="form-control mb-3"
                                                                rows="3"
                                                                placeholder="Comentario opcional o describa el problema"
                                                                value={
                                                                    comentariosCliente[
                                                                        pedidoHistorialSeleccionado
                                                                            .id
                                                                    ] || ""
                                                                }
                                                                onChange={(e) =>
                                                                    setComentariosCliente(
                                                                        {
                                                                            ...comentariosCliente,
                                                                            [pedidoHistorialSeleccionado.id]:
                                                                                e
                                                                                    .target
                                                                                    .value
                                                                        }
                                                                    )
                                                                }
                                                            ></textarea>

                                                            <div className="d-flex flex-column flex-md-row gap-2">

                                                                <button
                                                                    className="btn btn-success"
                                                                    onClick={() =>
                                                                        handleConfirmarRecepcion(
                                                                            pedidoHistorialSeleccionado,
                                                                            "confirmado"
                                                                        )
                                                                    }
                                                                >
                                                                    Confirmar recibido
                                                                </button>

                                                                <button
                                                                    className="btn btn-danger"
                                                                    onClick={() =>
                                                                        handleConfirmarRecepcion(
                                                                            pedidoHistorialSeleccionado,
                                                                            "problema"
                                                                        )
                                                                    }
                                                                >
                                                                    Reportar problema
                                                                </button>

                                                            </div>

                                                        </>
                                                    )}

                                                </>
                                            )}

                                        </div>

                                    </div>

                                    <div className="card border-0 shadow-sm rounded-4">

                                        <div className="card-body p-4">

                                            <h4 className="fw-bold mb-3">
                                                Historial del pedido
                                            </h4>

                                            {historial.length === 0 ? (

                                                <p className="text-muted mb-0">
                                                    Este pedido aún no tiene historial.
                                                </p>

                                            ) : (

                                                <ul className="list-group list-group-flush">

                                                    {historial.map(
                                                        (item) => (

                                                            <li
                                                                className="list-group-item"
                                                                key={
                                                                    item.id
                                                                }
                                                            >

                                                                <div className="d-flex justify-content-between gap-2">

                                                                    <span
                                                                        className={getEstadoBadge(
                                                                            item.estado
                                                                        )}
                                                                    >
                                                                        {
                                                                            item.estado
                                                                        }
                                                                    </span>

                                                                    <small className="text-muted">

                                                                        {new Date(
                                                                            item.fecha
                                                                        ).toLocaleString()}

                                                                    </small>

                                                                </div>

                                                                <p className="mt-2 mb-0">
                                                                    {
                                                                        item.comentario
                                                                    }
                                                                </p>

                                                            </li>
                                                        )
                                                    )}

                                                </ul>
                                            )}

                                        </div>

                                    </div>

                                </>
                            )}

                        </div>

                    </div>
                )}



                {pedidoCancelar && (
                    <div
                        className="adomi-client__overlay"
                        onMouseDown={() => {
                            if (!cancelandoPedido) {
                                setPedidoCancelar(null);
                                setMotivoCancelacion("");
                            }
                        }}
                    >
                        <div
                            className="adomi-client__modal"
                            onMouseDown={(e) => e.stopPropagation()}
                        >
                            <div className="adomi-client__modal-header">
                                <div>
                                    <small className="text-muted">Pedido #{pedidoCancelar.id}</small>
                                    <h5 className="fw-bold mb-0">Cancelar pedido</h5>
                                </div>
                                <button
                                    type="button"
                                    className="btn-close"
                                    aria-label="Cerrar"
                                    disabled={cancelandoPedido}
                                    onClick={() => {
                                        setPedidoCancelar(null);
                                        setMotivoCancelacion("");
                                    }}
                                ></button>
                            </div>

                            <div className="adomi-client__modal-body">
                                <div className="alert alert-warning border-0 rounded-4">
                                    <i className="bi bi-exclamation-triangle me-2"></i>
                                    Esta acción cancelará el pedido y lo moverá a tu historial.
                                </div>

                                <label className="form-label fw-semibold">
                                    Motivo de cancelación
                                    <span className="text-muted fw-normal"> (opcional)</span>
                                </label>
                                <textarea
                                    className="form-control mb-3"
                                    rows="3"
                                    maxLength="300"
                                    placeholder="Ejemplo: Ya no necesito el pedido"
                                    value={motivoCancelacion}
                                    disabled={cancelandoPedido}
                                    onChange={(e) => setMotivoCancelacion(e.target.value)}
                                ></textarea>

                                <div className="d-flex flex-column flex-sm-row justify-content-end gap-2">
                                    <button
                                        type="button"
                                        className="btn btn-outline-secondary"
                                        disabled={cancelandoPedido}
                                        onClick={() => {
                                            setPedidoCancelar(null);
                                            setMotivoCancelacion("");
                                        }}
                                    >
                                        Volver
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-danger"
                                        disabled={cancelandoPedido}
                                        onClick={handleCancelarPedidoCliente}
                                    >
                                        {cancelandoPedido ? (
                                            <>
                                                <span className="spinner-border spinner-border-sm me-2"></span>
                                                Cancelando...
                                            </>
                                        ) : (
                                            <>
                                                <i className="bi bi-x-circle me-2"></i>
                                                Sí, cancelar pedido
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {panelPedido && pedidoActivoSeleccionado && (
                    <div className="adomi-client__overlay" onMouseDown={() => setPanelPedido(null)}>
                        <div className="adomi-client__modal" onMouseDown={(e) => e.stopPropagation()}>
                            <div className="adomi-client__modal-header">
                                <div><small className="text-muted">Pedido #{pedidoActivoSeleccionado.id}</small><h5 className="fw-bold mb-0">{panelPedido === "mapa" ? "Seguimiento del repartidor" : "Chat con repartidor"}</h5></div>
                                <button type="button" className="btn-close" aria-label="Cerrar" onClick={() => setPanelPedido(null)}></button>
                            </div>
                            <div className="adomi-client__modal-body">
                                {panelPedido === "mapa" && ubicacionRepartidor && <DeliveryMap latitud={ubicacionRepartidor.latitud} longitud={ubicacionRepartidor.longitud} titulo="Ubicación del repartidor" altura="min(58vh, 520px)" />}
                                {panelPedido === "chat" && pedidoActivoSeleccionado.repartidor_id && <OrderChat pedidoId={pedidoActivoSeleccionado.id} />}
                            </div>
                        </div>
                    </div>
                )}

            </main>

        </div>
    );
}

export default ClienteDashboard;