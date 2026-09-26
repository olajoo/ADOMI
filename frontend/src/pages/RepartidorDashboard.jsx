import { useEffect, useRef, useState } from "react";

import {
    getPendingOrders,
    getMyDeliveries,
    acceptOrder,
    cancelOrder,
    updateOrderStatus,
    confirmRealTotal,
    confirmDelivery
} from "../services/orderService";

import { updateMyLocation } from "../services/locationService";

import OrderChat from "../components/OrderChat";
import DeliveryMap from "../components/DeliveryMap";
import socket from "../socket";
import "./RepartidorDashboard.css";


function RepartidorDashboard() {

    
    const user = JSON.parse(
        localStorage.getItem("user")
    );


    const [vista, setVista] =
        useState("pendientes");

    const [pendientes, setPendientes] =
        useState([]);

    const [entregas, setEntregas] =
        useState([]);

    const [
        entregaSeleccionada,
        setEntregaSeleccionada
    ] = useState(null);

    const [
        historialSeleccionado,
        setHistorialSeleccionado
    ] = useState(null);

    const [mensaje, setMensaje] =
        useState("");

    const [error, setError] =
        useState("");

    const [notificacion, setNotificacion] =
        useState("");

    const [panelPedido, setPanelPedido] = useState(null);


    const [totalesReales, setTotalesReales] =
        useState({});

    const [
        observacionesEntrega,
        setObservacionesEntrega
    ] = useState({});

    const [ubicacionActiva, setUbicacionActiva] =
        useState(false);

    const [
        obteniendoUbicacion,
        setObteniendoUbicacion
    ] = useState(false);

    const [
        ultimaUbicacion,
        setUltimaUbicacion
    ] = useState(null);

    const [
        ubicacionMensaje,
        setUbicacionMensaje
    ] = useState("");

    const watchIdRef = useRef(null);
    const joinedOrderRoomsRef = useRef(new Set());

    const ultimoEnvioUbicacionRef =
        useRef(0);

    const [
        confirmacionTotal,
        setConfirmacionTotal
    ] = useState(null);

    const [
        guardandoTotal,
        setGuardandoTotal
    ] = useState(false);

    const entregasActivas = entregas.filter(
        (pedido) =>
            pedido.estado !== "entregado" &&
            pedido.estado !== "cancelado"
    );

    const entregasFinalizadas = entregas.filter(
        (pedido) =>
            pedido.estado === "entregado" ||
            pedido.estado === "cancelado"
    );


    const limpiarMensajes = () => {
        setMensaje("");
        setError("");
    };


    const cargarDatos = async () => {

        try {

            const [
                pendientesData,
                entregasData
            ] = await Promise.all([
                getPendingOrders(),
                getMyDeliveries()
            ]);

            const pedidosPendientes =
                pendientesData.pedidos || [];

            const pedidosEntregas =
                entregasData.pedidos || [];

            setPendientes(
                pedidosPendientes
            );

            setEntregas(
                pedidosEntregas
            );


            // Actualizar entrega seleccionada

            if (entregaSeleccionada) {

                const actualizada =
                    pedidosEntregas.find(
                        (pedido) =>
                            pedido.id ===
                            entregaSeleccionada.id
                    );

                if (actualizada) {

                    if (
                        actualizada.estado ===
                            "entregado" ||
                        actualizada.estado ===
                            "cancelado"
                    ) {

                        setEntregaSeleccionada(
                            null
                        );

                    } else {

                        setEntregaSeleccionada(
                            actualizada
                        );

                    }
                }
            }


            // Actualizar historial seleccionado

            if (historialSeleccionado) {

                const actualizada =
                    pedidosEntregas.find(
                        (pedido) =>
                            pedido.id ===
                            historialSeleccionado.id
                    );

                if (actualizada) {

                    setHistorialSeleccionado(
                        actualizada
                    );

                }
            }

        } catch (error) {

            console.error(error);

            setError(
                "No se pudieron cargar los pedidos"
            );
        }
    };


    useEffect(() => {

        cargarDatos();

        const interval = setInterval(() => {
            cargarDatos();
        }, 5000);

        return () => clearInterval(interval);

    }, []);


    useEffect(() => {

        const joinRooms = () => {
            entregas.forEach((pedido) => {
                if (!joinedOrderRoomsRef.current.has(pedido.id)) {
                    socket.emit(
                        "joinOrderRoom",
                        pedido.id
                    );
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

    }, [entregas]);


    useEffect(() => {

        const actualizarPedido = (
            pedidoActualizado
        ) => {

            setEntregas(
                (prevEntregas) =>
                    prevEntregas.map(
                        (pedido) =>
                            pedido.id ===
                            pedidoActualizado.id
                                ? {
                                      ...pedido,
                                      ...pedidoActualizado
                                  }
                                : pedido
                    )
            );


            setEntregaSeleccionada(
                (prev) => {

                    if (
                        !prev ||
                        prev.id !==
                            pedidoActualizado.id
                    ) {
                        return prev;
                    }

                    const actualizado = {
                        ...prev,
                        ...pedidoActualizado
                    };

                    if (
                        actualizado.estado ===
                            "entregado" ||
                        actualizado.estado ===
                            "cancelado"
                    ) {
                        return null;
                    }

                    return actualizado;
                }
            );


            setHistorialSeleccionado(
                (prev) => {

                    if (
                        !prev ||
                        prev.id !==
                            pedidoActualizado.id
                    ) {
                        return prev;
                    }

                    return {
                        ...prev,
                        ...pedidoActualizado
                    };
                }
            );


            setNotificacion(
                `Pedido #${pedidoActualizado.id} actualizado`
            );

            setTimeout(() => {

                setNotificacion("");

            }, 4000);
        };


        socket.on(
            "pedidoActualizado",
            actualizarPedido
        );


        return () => {

            socket.off(
                "pedidoActualizado",
                actualizarPedido
            );

        };

    }, []);


    const cerrarSesion = () => {

        if (
            watchIdRef.current !== null &&
            navigator.geolocation
        ) {

            navigator.geolocation.clearWatch(
                watchIdRef.current
            );
        }

        localStorage.clear();

        window.location.href = "/";
    };


    const compartirUbicacion = () => {

        limpiarMensajes();

        if (!navigator.geolocation) {

            setError(
                "Tu dispositivo o navegador no permite utilizar la ubicación."
            );

            return;
        }


        // Evitar crear múltiples watchPosition

        if (watchIdRef.current !== null) {

            setUbicacionMensaje(
                ubicacionActiva
                    ? "Tu ubicación ya está activa."
                    : "El seguimiento GPS ya está iniciado. Esperando una ubicación válida..."
            );

            return;
        }


        setObteniendoUbicacion(true);


        const opciones = {

            enableHighAccuracy: true,

            timeout: 15000,

            maximumAge: 5000
        };


        const watchId =
            navigator.geolocation.watchPosition(

                async (position) => {

                    const ahora = Date.now();


                    // Evitar demasiadas peticiones.
                    // Enviar máximo aproximadamente
                    // cada 5 segundos.

                    if (
                        ahora -
                            ultimoEnvioUbicacionRef.current <
                        5000
                    ) {
                        return;
                    }


                    ultimoEnvioUbicacionRef.current =
                        ahora;


                    const latitud =
                        position.coords.latitude;

                    const longitud =
                        position.coords.longitude;


                    try {

                        await updateMyLocation(
                            latitud,
                            longitud
                        );


                        setUbicacionActiva(
                            true
                        );

                        setObteniendoUbicacion(
                            false
                        );

                        setUltimaUbicacion({
                            latitud,
                            longitud,
                            fecha: new Date()
                        });

                        setUbicacionMensaje(
                            "Ubicación activa y compartiéndose correctamente"
                        );

                    } catch (error) {

                        console.error(error);

                        setUbicacionActiva(
                            false
                        );

                        setObteniendoUbicacion(
                            false
                        );

                        setError(
                            "Se obtuvo tu ubicación, pero no se pudo enviar al servidor."
                        );
                    }

                },


                (geoError) => {

                    console.error(
                        "Error de geolocalización:",
                        geoError
                    );


                    setUbicacionActiva(
                        false
                    );

                    setObteniendoUbicacion(
                        false
                    );


                    if (geoError.code === 1) {

                        setError(
                            "Debes permitir el acceso a tu ubicación para realizar entregas."
                        );

                    } else if (
                        geoError.code === 2
                    ) {

                        setError(
                            "No se pudo determinar tu ubicación. Verifica que el GPS esté activo."
                        );

                    } else if (
                        geoError.code === 3
                    ) {

                        setError(
                            "La ubicación tardó demasiado en responder. Intenta nuevamente."
                        );

                    } else {

                        setError(
                            "No se pudo obtener tu ubicación."
                        );
                    }

                },

                opciones
            );


        watchIdRef.current =
            watchId;
    };


    useEffect(() => {

        return () => {

            if (
                watchIdRef.current !== null &&
                navigator.geolocation
            ) {

                navigator.geolocation.clearWatch(
                    watchIdRef.current
                );

                watchIdRef.current =
                    null;
            }

        };

    }, []);


    const verificarUbicacion = () => {

        if (!ubicacionActiva) {

            setError(
                "Debes activar y compartir tu ubicación antes de realizar esta acción."
            );


            window.scrollTo({
                top: 0,
                behavior: "smooth"
            });


            return false;
        }


        return true;
    };


    const handleAceptar = async (id) => {

        limpiarMensajes();


        if (!verificarUbicacion()) {
            return;
        }


        try {

            await acceptOrder(id);


            setMensaje(
                "Pedido aceptado correctamente"
            );


            await cargarDatos();


            setVista("activa");

        } catch (error) {

            setError(
                error.response?.data?.message ||
                    "Error al aceptar pedido"
            );
        }
    };


    const handleCancelarPedido = async (pedido) => {
        limpiarMensajes();

        if (!pedido) {
            return;
        }

        if (
            pedido.estado !== "aceptado" &&
            pedido.estado !== "en camino"
        ) {
            setError(
                "Este pedido ya no puede ser cancelado."
            );
            return;
        }

        const confirmar = window.confirm(
            `¿Seguro que deseas cancelar el pedido #${pedido.id}?\n\nEl pedido pasará a estado Cancelado y deberá ser revisado por un administrador para reactivarlo.`
        );

        if (!confirmar) {
            return;
        }

        try {
            await cancelOrder(pedido.id);

            const pedidoActualizado = {
                ...pedido,
                estado: "cancelado"
            };

            setEntregaSeleccionada(null);
            setHistorialSeleccionado(
                pedidoActualizado
            );

            setEntregas((prevEntregas) =>
                prevEntregas.map((item) =>
                    item.id === pedido.id
                        ? pedidoActualizado
                        : item
                )
            );

            setMensaje(
                "Pedido cancelado correctamente"
            );

            await cargarDatos();
            setVista("historial");

        } catch (error) {
            setError(
                error.response?.data?.message ||
                    "Error al cancelar pedido"
            );
        }
    };


    const handleCambiarEstado =
        async (pedido) => {

            limpiarMensajes();


            if (!verificarUbicacion()) {
                return;
            }


            if (
                pedido.estado !== "aceptado"
            ) {

                setError(
                    "Este pedido ya no puede cambiar a En camino."
                );

                return;
            }


            try {

                await updateOrderStatus(
                    pedido.id,
                    "en camino"
                );


                const pedidoActualizado = {

                    ...pedido,

                    estado: "en camino"
                };


                setEntregaSeleccionada(
                    pedidoActualizado
                );


                setEntregas(
                    (prevEntregas) =>
                        prevEntregas.map(
                            (item) =>
                                item.id ===
                                pedido.id
                                    ? pedidoActualizado
                                    : item
                        )
                );


                setMensaje(
                    "Pedido actualizado a En camino"
                );


                await cargarDatos();

            } catch (error) {

                setError(
                    error.response?.data?.message ||
                        "Error al cambiar estado"
                );
            }
        };


    const handleConfirmarTotal =
        (pedido) => {

            limpiarMensajes();


            if (!verificarUbicacion()) {
                return;
            }


            const valorIngresado =
                totalesReales[pedido.id];


            if (
                valorIngresado === undefined ||
                valorIngresado === null ||
                valorIngresado === ""
            ) {

                setError(
                    "Ingrese el total real del pedido"
                );

                return;
            }


            const totalReal =
                Number(valorIngresado);


            if (
                !Number.isFinite(totalReal)
            ) {

                setError(
                    "Ingrese una cantidad válida"
                );

                return;
            }


            if (totalReal <= 0) {

                setError(
                    "El total real debe ser mayor que Q0.00"
                );

                return;
            }


            if (
                totalReal > 99999999.99
            ) {

                setError(
                    "La cantidad ingresada es demasiado grande"
                );

                return;
            }


            if (
                pedido.total_real !== null &&
                pedido.total_real !== undefined
            ) {

                setError(
                    "El total real de este pedido ya fue confirmado"
                );

                return;
            }


            const totalEstimado =
                Number(pedido.total);


            const diferencia =
                Number(
                    (
                        totalReal -
                        totalEstimado
                    ).toFixed(2)
                );


            // Abrir confirmación propia de ADOMI

            setConfirmacionTotal({

                pedido,

                totalReal,

                totalEstimado,

                diferencia
            });
        };


    const guardarTotalConfirmado =
        async () => {

            if (!confirmacionTotal) {
                return;
            }


            const {
                pedido,
                totalReal
            } = confirmacionTotal;


            if (!verificarUbicacion()) {

                setConfirmacionTotal(
                    null
                );

                return;
            }


            setGuardandoTotal(true);


            try {

                const data =
                    await confirmRealTotal(
                        pedido.id,
                        totalReal
                    );


                const pedidoActualizado = {

                    ...pedido,

                    total_real:
                        totalReal,

                    diferencia:
                        data.diferencia
                };


                setEntregaSeleccionada(
                    pedidoActualizado
                );


                setEntregas(
                    (prevEntregas) =>
                        prevEntregas.map(
                            (item) =>
                                item.id ===
                                pedido.id
                                    ? pedidoActualizado
                                    : item
                        )
                );


                setMensaje(
                    `Total real confirmado correctamente: Q${totalReal.toFixed(
                        2
                    )}`
                );


                setTotalesReales(
                    (prev) => ({
                        ...prev,

                        [pedido.id]: ""
                    })
                );


                setConfirmacionTotal(
                    null
                );


                await cargarDatos();

            } catch (error) {

                setError(
                    error.response?.data?.message ||
                        "Error al confirmar total"
                );

            } finally {

                setGuardandoTotal(
                    false
                );
            }
        };

    const handleConfirmarEntrega =
        async (pedido) => {

            limpiarMensajes();


            if (!verificarUbicacion()) {
                return;
            }


            if (
                pedido.estado !==
                "en camino"
            ) {

                setError(
                    "El pedido debe estar En camino antes de confirmar la entrega."
                );

                return;
            }


            if (
                pedido.total_real === null ||
                pedido.total_real ===
                    undefined
            ) {

                setError(
                    "Debe confirmar el total real antes de completar la entrega."
                );

                return;
            }


            const observacion =
                observacionesEntrega[
                    pedido.id
                ];


            if (
                !observacion ||
                !observacion.trim()
            ) {

                setError(
                    "Ingrese una observación de entrega"
                );

                return;
            }


            try {

                await confirmDelivery(
                    pedido.id,
                    observacion.trim()
                );


                const pedidoActualizado = {

                    ...pedido,

                    estado: "entregado",

                    observacion_entrega:
                        observacion.trim(),

                    fecha_entrega:
                        new Date().toISOString()
                };


                setEntregaSeleccionada(
                    null
                );


                setHistorialSeleccionado(
                    pedidoActualizado
                );


                setEntregas(
                    (prevEntregas) =>
                        prevEntregas.map(
                            (item) =>
                                item.id ===
                                pedido.id
                                    ? pedidoActualizado
                                    : item
                        )
                );


                setMensaje(
                    "Entrega confirmada correctamente"
                );


                setObservacionesEntrega(
                    (prev) => ({
                        ...prev,

                        [pedido.id]: ""
                    })
                );


                await cargarDatos();


                setVista("historial");

            } catch (error) {

                setError(
                    error.response?.data?.message ||
                        "Error al confirmar entrega"
                );
            }
        };


    const getEstadoBadge =
        (estado) => {

            if (
                estado === "pendiente"
            ) {
                return "badge bg-secondary";
            }

            if (
                estado === "aceptado"
            ) {
                return "badge bg-primary";
            }

            if (
                estado === "en camino"
            ) {
                return "badge bg-warning text-dark";
            }

            if (
                estado === "entregado"
            ) {
                return "badge bg-success";
            }

            if (
                estado === "cancelado"
            ) {
                return "badge bg-danger";
            }


            return "badge bg-dark";
        };


    const getConfirmacionCliente =
        (pedido) => {

            if (
                pedido.confirmacion_cliente ===
                "confirmado"
            ) {

                return (
                    <span className="badge bg-success">
                        Cliente confirmó recibido
                    </span>
                );
            }


            if (
                pedido.confirmacion_cliente ===
                "problema"
            ) {

                return (
                    <span className="badge bg-danger">
                        Cliente reportó problema
                    </span>
                );
            }


            return (
                <span className="badge bg-secondary">
                    Pendiente de cliente
                </span>
            );
        };


    const formatoDinero = (valor) => {

        const numero =
            Number(valor);

        if (
            !Number.isFinite(numero)
        ) {
            return "Q0.00";
        }


        return `Q${numero.toFixed(2)}`;
    };


    const tieneUbicacionCliente = (pedido) => {

        if (!pedido) {
            return false;
        }

        const latitud =
            Number(pedido.cliente_latitud);

        const longitud =
            Number(pedido.cliente_longitud);

        return (
            Number.isFinite(latitud) &&
            Number.isFinite(longitud) &&
            latitud >= -90 &&
            latitud <= 90 &&
            longitud >= -180 &&
            longitud <= 180
        );
    };

    return (

        <div className="min-vh-100 bg-light adomi-driver">


            {/* ==========================================
                NAVBAR
            ========================================== */}

            <nav className="navbar navbar-dark bg-dark shadow-sm sticky-top adomi-driver__navbar">

                <div className="container-fluid px-3 px-md-4">

                    <span className="navbar-brand fw-bold">

                        <i className="bi bi-truck me-2"></i>

                        ADOMI

                        <span className="d-none d-sm-inline">
                            {" "}Repartidor
                        </span>

                    </span>


                    <div className="d-flex align-items-center gap-2">

                        <span className="text-white d-none d-md-block">

                            {user?.nombre}

                        </span>


                        <button
                            type="button"
                            className="btn btn-outline-light btn-sm"
                            onClick={cerrarSesion}
                        >

                            <i className="bi bi-box-arrow-right me-md-2"></i>

                            <span className="d-none d-md-inline">
                                Cerrar sesión
                            </span>

                        </button>

                    </div>

                </div>

            </nav>


            {/* ==========================================
                CONTENIDO
            ========================================== */}

            <div className="adomi-driver__shell">

                <aside className="adomi-driver__sidebar">
                    <div className="adomi-driver__sidebar-title">MENÚ</div>

                    <button type="button" className={`adomi-driver__side-link ${vista === "pendientes" ? "active" : ""}`} onClick={() => setVista("pendientes")}>
                        <i className="bi bi-hourglass-split"></i>
                        <span>Disponibles</span>
                        <span className="adomi-driver__side-count">{pendientes.length}</span>
                    </button>

                    <button type="button" className={`adomi-driver__side-link ${vista === "activa" ? "active" : ""}`} onClick={() => setVista("activa")}>
                        <i className="bi bi-truck"></i>
                        <span>Mis entregas</span>
                        <span className="adomi-driver__side-count">{entregasActivas.length}</span>
                    </button>

                    <button type="button" className={`adomi-driver__side-link ${vista === "historial" ? "active" : ""}`} onClick={() => setVista("historial")}>
                        <i className="bi bi-clock-history"></i>
                        <span>Historial</span>
                    </button>

                    <div className="adomi-driver__sidebar-note">
                        <i className="bi bi-geo-alt"></i>
                        <span>Activa tu ubicación para aceptar y gestionar entregas.</span>
                    </div>
                </aside>

                <main className="container-fluid px-3 px-md-4 py-3 py-md-4 adomi-driver__main">


                {/* NOTIFICACIONES */}

                {notificacion && (

                    <div className="alert alert-info shadow-sm rounded-4">

                        <i className="bi bi-bell me-2"></i>

                        {notificacion}

                    </div>

                )}


                {mensaje && (

                    <div className="alert alert-success shadow-sm rounded-4">

                        <i className="bi bi-check-circle me-2"></i>

                        {mensaje}

                    </div>

                )}


                {error && (

                    <div className="alert alert-danger shadow-sm rounded-4">

                        <i className="bi bi-exclamation-triangle me-2"></i>

                        {error}

                    </div>

                )}


                {/* ======================================
                    CABECERA
                ====================================== */}

                <div className="card border-0 shadow-sm rounded-4 mb-3 adomi-driver__detail-card">

                    <div className="card-body p-3 p-md-4">

                        <h2 className="fw-bold fs-4 mb-1">

                            Panel del Repartidor

                        </h2>


                        <p className="text-muted small mb-3">

                            Gestiona tus pedidos y comparte tu ubicación durante las entregas.

                        </p>


                        <div className="d-flex flex-wrap gap-2 mb-3">

                            <span className="badge bg-secondary">

                                Pendientes: {pendientes.length}

                            </span>


                            <span className="badge bg-primary">

                                Activas: {entregasActivas.length}

                            </span>


                            <span className="badge bg-success">

                                Finalizadas: {entregasFinalizadas.length}

                            </span>

                        </div>


                        {/* UBICACIÓN */}

                        {!ubicacionActiva ? (

                            <div className="alert alert-warning border-0 rounded-4 mb-0">

                                <div className="d-flex align-items-start gap-3">

                                    <i className="bi bi-geo-alt-fill fs-3"></i>


                                    <div className="flex-grow-1">

                                        <h6 className="fw-bold mb-1">

                                            Ubicación requerida

                                        </h6>


                                        <p className="small mb-3">

                                            Para aceptar y realizar entregas debes compartir tu ubicación con ADOMI.

                                        </p>


                                        <button
                                            type="button"
                                            className="btn btn-dark w-100 w-sm-auto"
                                            onClick={compartirUbicacion}
                                            disabled={obteniendoUbicacion}
                                        >

                                            {obteniendoUbicacion ? (

                                                <>

                                                    <span className="spinner-border spinner-border-sm me-2"></span>

                                                    Obteniendo ubicación...

                                                </>

                                            ) : (

                                                <>

                                                    <i className="bi bi-crosshair me-2"></i>

                                                    Activar ubicación

                                                </>

                                            )}

                                        </button>

                                    </div>

                                </div>

                            </div>

                        ) : (

                            <div className="alert alert-success border-0 rounded-4 mb-0">

                                <div className="d-flex align-items-center gap-3">

                                    <i className="bi bi-geo-alt-fill fs-3"></i>


                                    <div>

                                        <strong>

                                            Ubicación activa

                                        </strong>


                                        <div className="small">

                                            Tu ubicación se está compartiendo con ADOMI.

                                        </div>


                                        {ultimaUbicacion && (

                                            <div className="small mt-1">

                                                Actualizada:{" "}

                                                {ultimaUbicacion.fecha
                                                    ? ultimaUbicacion.fecha.toLocaleTimeString()
                                                    : ""}

                                            </div>

                                        )}


                                        {ubicacionMensaje && (

                                            <div className="small mt-1">

                                                {ubicacionMensaje}

                                            </div>

                                        )}

                                    </div>

                                </div>

                            </div>

                        )}

                    </div>

                </div>


                {/* ======================================
                    PEDIDOS PENDIENTES
                ====================================== */}

                {vista === "pendientes" && (

                    <div className="card border-0 shadow-sm rounded-4">

                        <div className="card-body p-3 p-md-4">


                            <div className="d-flex justify-content-between align-items-center mb-3">

                                <div>

                                    <h4 className="fw-bold fs-5 mb-0">

                                        Pedidos disponibles

                                    </h4>


                                    <small className="text-muted">

                                        Selecciona un pedido para comenzar.

                                    </small>

                                </div>


                                <button
                                    type="button"
                                    className="btn btn-outline-dark btn-sm"
                                    onClick={cargarDatos}
                                >

                                    <i className="bi bi-arrow-clockwise"></i>

                                </button>

                            </div>


                            {pendientes.length === 0 ? (

                                <div className="text-center py-5">

                                    <i className="bi bi-inbox fs-1 text-muted"></i>


                                    <p className="text-muted mt-3 mb-0">

                                        No hay pedidos pendientes.

                                    </p>

                                </div>

                            ) : (

                                <div className="row g-3">

                                    {pendientes.map(
                                        (pedido) => (

                                            <div
                                                className="col-12 col-md-6 col-xl-4"
                                                key={pedido.id}
                                            >

                                                <div className="card border h-100 rounded-4 adomi-driver__order-card">

                                                    <div className="card-body p-3">


                                                        <div className="d-flex justify-content-between align-items-start mb-3">

                                                            <div>

                                                                <h5 className="fw-bold mb-1">

                                                                    Pedido #{pedido.id}

                                                                </h5>


                                                                <small className="text-muted">

                                                                    {pedido.cliente_nombre}

                                                                </small>

                                                            </div>


                                                            <span
                                                                className={getEstadoBadge(
                                                                    pedido.estado
                                                                )}
                                                            >

                                                                {pedido.estado}

                                                            </span>

                                                        </div>


                                                        {pedido.lugar_compra && (
                                                            <div className="bg-warning-subtle border border-warning-subtle rounded-3 p-2 mb-3">
                                                                <small className="text-muted d-block">
                                                                    Recoger en
                                                                </small>
                                                                <div className="fw-bold">
                                                                    <i className="bi bi-shop me-2"></i>
                                                                    {pedido.lugar_compra}
                                                                </div>
                                                            </div>
                                                        )}


                                                        <p className="small mb-2">

                                                            <strong>
                                                                Servicio:
                                                            </strong>{" "}

                                                            <span className="text-capitalize">

                                                                {pedido.tipo_servicio}

                                                            </span>

                                                        </p>


                                                        <p className="small mb-2">

                                                            <strong>
                                                                Pedido:
                                                            </strong>{" "}

                                                            {pedido.descripcion}

                                                        </p>


                                                        <p className="small mb-2">

                                                            <strong>
                                                                Dirección:
                                                            </strong>{" "}

                                                            {pedido.direccion}

                                                        </p>


                                                        <div className="bg-light rounded-3 p-2 mb-3">

                                                            <small className="text-muted">

                                                                Total estimado

                                                            </small>


                                                            <div className="fw-bold">

                                                                {formatoDinero(
                                                                    pedido.total
                                                                )}

                                                            </div>

                                                        </div>


                                                        <button
                                                            type="button"
                                                            className={
                                                                ubicacionActiva
                                                                    ? "btn btn-success w-100"
                                                                    : "btn btn-secondary w-100"
                                                            }
                                                            onClick={() =>
                                                                handleAceptar(
                                                                    pedido.id
                                                                )
                                                            }
                                                        >

                                                            <i className="bi bi-check-circle me-2"></i>

                                                            {ubicacionActiva
                                                                ? "Aceptar pedido"
                                                                : "Activa ubicación para aceptar"}

                                                        </button>

                                                    </div>

                                                </div>

                                            </div>

                                        )
                                    )}

                                </div>

                            )}

                        </div>

                    </div>

                )}


                {/* ======================================
                    ENTREGAS ACTIVAS
                ====================================== */}

                {vista === "activa" && (

                    <div className="row g-3 g-xl-4">


                        {/* LISTA */}

                        <div className="col-12 col-xl-5">

                            <div className="card border-0 shadow-sm rounded-4">

                                <div className="card-body p-3 p-md-4">


                                    <div className="d-flex justify-content-between align-items-center mb-3">

                                        <h4 className="fw-bold fs-5 mb-0">

                                            Mis entregas

                                        </h4>


                                        <button
                                            type="button"
                                            className="btn btn-outline-primary btn-sm"
                                            onClick={cargarDatos}
                                        >

                                            <i className="bi bi-arrow-clockwise"></i>

                                        </button>

                                    </div>


                                    {entregasActivas.length === 0 ? (

                                        <div className="text-center py-4">

                                            <i className="bi bi-truck fs-1 text-muted"></i>

                                            <p className="text-muted mt-2 mb-0">

                                                No tienes entregas activas.

                                            </p>

                                        </div>

                                    ) : (

                                        entregasActivas.map(
                                            (pedido) => (

                                                <button
                                                    type="button"
                                                    key={pedido.id}
                                                    className={`card w-100 text-start rounded-4 mb-2 adomi-driver__delivery-card ${
                                                        entregaSeleccionada?.id ===
                                                        pedido.id
                                                            ? "border-primary"
                                                            : "border"
                                                    }`}
                                                    onClick={() =>
                                                        setEntregaSeleccionada((actual) =>
                                                            actual?.id === pedido.id ? null : pedido
                                                        )
                                                    }
                                                >

                                                    <div className="card-body p-3">

                                                        <div className="d-flex justify-content-between align-items-start">

                                                            <div>

                                                                <strong>

                                                                    Pedido #{pedido.id}

                                                                </strong>


                                                                <div className="small text-muted">

                                                                    {pedido.cliente_nombre}

                                                                </div>

                                                                {pedido.lugar_compra && (
                                                                    <div className="small fw-semibold text-primary mt-1">
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


                                                        <div className="small mt-2 text-truncate">

                                                            {pedido.descripcion}

                                                        </div>

                                                    </div>

                                                </button>

                                            )
                                        )

                                    )}

                                </div>

                            </div>

                        </div>


                        {/* DETALLE */}

                        <div className="col-12 col-xl-7">


                            {!entregaSeleccionada ? (

                                <div className="card border-0 shadow-sm rounded-4">

                                    <div className="card-body text-center py-5">

                                        <i className="bi bi-hand-index fs-1 text-muted"></i>


                                        <p className="text-muted mt-3 mb-0">

                                            Selecciona una entrega para gestionarla.

                                        </p>

                                    </div>

                                </div>

                            ) : (

                                <>

                                    <div className="card border-0 shadow-sm rounded-4 mb-3">

                                        <div className="card-body p-3 p-md-4">


                                            <button type="button" className="btn btn-link adomi-driver__back-mobile p-0 mb-3 text-decoration-none" onClick={() => setEntregaSeleccionada(null)}>
                                                <i className="bi bi-arrow-left me-2"></i>Volver a mis entregas
                                            </button>

                                            <div className="d-flex justify-content-between align-items-start mb-3">

                                                <div>

                                                    <h4 className="fw-bold fs-5 mb-1">

                                                        Pedido #{entregaSeleccionada.id}

                                                    </h4>


                                                    <small className="text-muted">

                                                        {entregaSeleccionada.cliente_nombre}

                                                    </small>

                                                </div>


                                                <span
                                                    className={getEstadoBadge(
                                                        entregaSeleccionada.estado
                                                    )}
                                                >

                                                    {entregaSeleccionada.estado}

                                                </span>

                                            </div>


                                            {entregaSeleccionada.lugar_compra && (
                                                <div className="border border-primary rounded-4 p-3 mb-3 bg-primary-subtle">
                                                    <small className="text-muted d-block mb-1">
                                                        Lugar de recogida
                                                    </small>
                                                    <h5 className="fw-bold text-primary mb-0">
                                                        <i className="bi bi-shop me-2"></i>
                                                        {entregaSeleccionada.lugar_compra}
                                                    </h5>
                                                </div>
                                            )}


                                            <div className="bg-light rounded-4 p-3 mb-3">

                                                <div className="small mb-2">

                                                    <strong>
                                                        Pedido:
                                                    </strong>{" "}

                                                    {entregaSeleccionada.descripcion}

                                                </div>


                                                <div className="small mb-3">

                                                    <strong>
                                                        Dirección:
                                                    </strong>{" "}

                                                    {entregaSeleccionada.direccion}

                                                </div>


                                                {entregaSeleccionada.telefono_contacto && (
                                                    <div className="border-top pt-3">
                                                        <small className="text-muted d-block mb-2">
                                                            Teléfono de contacto
                                                        </small>

                                                        <div className="d-flex flex-column flex-sm-row align-items-sm-center gap-2">
                                                            <strong className="flex-grow-1">
                                                                <i className="bi bi-telephone-fill text-success me-2"></i>
                                                                {entregaSeleccionada.telefono_contacto}
                                                            </strong>

                                                            <a
                                                                className="btn btn-success"
                                                                href={`tel:${String(
                                                                    entregaSeleccionada.telefono_contacto
                                                                ).replace(/\D/g, "")}`}
                                                            >
                                                                <i className="bi bi-telephone-outbound me-2"></i>
                                                                Llamar al cliente
                                                            </a>
                                                        </div>
                                                    </div>
                                                )}

                                            </div>



                                            {/* TOTALES */}

                                            <div className="row g-2 mb-4">

                                                <div className="col-4">

                                                    <div className="bg-light rounded-4 p-2 p-md-3 h-100">

                                                        <small className="text-muted d-block">

                                                            Estimado

                                                        </small>


                                                        <strong>

                                                            {formatoDinero(
                                                                entregaSeleccionada.total
                                                            )}

                                                        </strong>

                                                    </div>

                                                </div>


                                                <div className="col-4">

                                                    <div className="bg-light rounded-4 p-2 p-md-3 h-100">

                                                        <small className="text-muted d-block">

                                                            Real

                                                        </small>


                                                        <strong>

                                                            {entregaSeleccionada.total_real !==
                                                                null &&
                                                            entregaSeleccionada.total_real !==
                                                                undefined
                                                                ? formatoDinero(
                                                                      entregaSeleccionada.total_real
                                                                  )
                                                                : "Pendiente"}

                                                        </strong>

                                                    </div>

                                                </div>


                                                <div className="col-4">

                                                    <div className="bg-light rounded-4 p-2 p-md-3 h-100">

                                                        <small className="text-muted d-block">

                                                            Diferencia

                                                        </small>


                                                        <strong>

                                                            {entregaSeleccionada.diferencia !==
                                                                null &&
                                                            entregaSeleccionada.diferencia !==
                                                                undefined
                                                                ? formatoDinero(
                                                                      entregaSeleccionada.diferencia
                                                                  )
                                                                : "Pendiente"}

                                                        </strong>

                                                    </div>

                                                </div>

                                            </div>


                                            {/* PASO 1 - TOTAL REAL */}

                                            <div className="border rounded-4 p-3 mb-3">

                                                <div className="d-flex align-items-center gap-2 mb-2">

                                                    <span className="badge rounded-pill bg-primary">

                                                        1

                                                    </span>


                                                    <strong>

                                                        Confirmar total real

                                                    </strong>

                                                </div>


                                                {entregaSeleccionada.total_real !==
                                                    null &&
                                                entregaSeleccionada.total_real !==
                                                    undefined ? (

                                                    <div className="alert alert-success mb-0">

                                                        <i className="bi bi-check-circle me-2"></i>

                                                        Total confirmado:{" "}

                                                        <strong>

                                                            {formatoDinero(
                                                                entregaSeleccionada.total_real
                                                            )}

                                                        </strong>

                                                    </div>

                                                ) : (

                                                    <div className="input-group">

                                                        <span className="input-group-text">

                                                            Q

                                                        </span>


                                                        <input
                                                            type="number"
                                                            inputMode="decimal"
                                                            className="form-control"
                                                            placeholder="Ej. 85.50"
                                                            min="0.01"
                                                            step="0.01"
                                                            value={
                                                                totalesReales[
                                                                    entregaSeleccionada
                                                                        .id
                                                                ] || ""
                                                            }
                                                            onChange={(e) => {

                                                                const valor =
                                                                    e.target.value;


                                                                if (
                                                                    valor ===
                                                                        "" ||
                                                                    Number(
                                                                        valor
                                                                    ) >= 0
                                                                ) {

                                                                    setTotalesReales(
                                                                        (
                                                                            prev
                                                                        ) => ({
                                                                            ...prev,

                                                                            [entregaSeleccionada.id]:
                                                                                valor
                                                                        })
                                                                    );
                                                                }
                                                            }}
                                                            onKeyDown={(e) => {

                                                                if (
                                                                    e.key ===
                                                                        "-" ||
                                                                    e.key ===
                                                                        "e" ||
                                                                    e.key ===
                                                                        "E"
                                                                ) {

                                                                    e.preventDefault();

                                                                }
                                                            }}
                                                        />


                                                        <button
                                                            type="button"
                                                            className="btn btn-primary"
                                                            onClick={() =>
                                                                handleConfirmarTotal(
                                                                    entregaSeleccionada
                                                                )
                                                            }
                                                        >

                                                            Confirmar

                                                        </button>

                                                    </div>

                                                )}

                                            </div>


                                            {/* PASO 2 - EN CAMINO */}

                                            <div className="border rounded-4 p-3 mb-3">

                                                <div className="d-flex align-items-center gap-2 mb-2">

                                                    <span className="badge rounded-pill bg-primary">

                                                        2

                                                    </span>


                                                    <strong>

                                                        Iniciar recorrido

                                                    </strong>

                                                </div>


                                                {entregaSeleccionada.estado ===
                                                "aceptado" ? (

                                                    <button
                                                        type="button"
                                                        className="btn btn-warning w-100"
                                                        onClick={() =>
                                                            handleCambiarEstado(
                                                                entregaSeleccionada
                                                            )
                                                        }
                                                    >

                                                        <i className="bi bi-truck me-2"></i>

                                                        Marcar como En camino

                                                    </button>

                                                ) : (

                                                    <div className="alert alert-warning mb-0">

                                                        <i className="bi bi-truck me-2"></i>

                                                        Pedido en camino

                                                    </div>

                                                )}

                                            </div>


                                            {/* HERRAMIENTAS BAJO DEMANDA */}
                                            <div className="adomi-driver__tools mb-3">
                                                <div>
                                                    <strong className="d-block mb-1">Herramientas del pedido</strong>
                                                    <small className="text-muted">Abre el mapa o el chat únicamente cuando lo necesites.</small>
                                                </div>
                                                <div className="adomi-driver__tools-actions">
                                                    <button type="button" className="btn btn-outline-primary" disabled={!tieneUbicacionCliente(entregaSeleccionada)} onClick={() => setPanelPedido("mapa")}>
                                                        <i className="bi bi-map me-2"></i>Ver ubicación
                                                    </button>
                                                    <button type="button" className="btn btn-dark" onClick={() => setPanelPedido("chat")}>
                                                        <i className="bi bi-chat-dots me-2"></i>Abrir chat
                                                    </button>
                                                </div>
                                            </div>


                                            {/* PASO 3 - ENTREGA */}

                                            <div className="border rounded-4 p-3">

                                                <div className="d-flex align-items-center gap-2 mb-2">

                                                    <span className="badge rounded-pill bg-success">

                                                        3

                                                    </span>


                                                    <strong>

                                                        Confirmar entrega

                                                    </strong>

                                                </div>


                                                <textarea
                                                    className="form-control mb-2"
                                                    rows="3"
                                                    maxLength="255"
                                                    placeholder="Ej. Entregado al cliente en la puerta principal"
                                                    value={
                                                        observacionesEntrega[
                                                            entregaSeleccionada
                                                                .id
                                                        ] || ""
                                                    }
                                                    onChange={(e) =>
                                                        setObservacionesEntrega(
                                                            (
                                                                prev
                                                            ) => ({
                                                                ...prev,

                                                                [entregaSeleccionada.id]:
                                                                    e
                                                                        .target
                                                                        .value
                                                            })
                                                        )
                                                    }
                                                />


                                                <button
                                                    type="button"
                                                    className="btn btn-success w-100"
                                                    disabled={
                                                        entregaSeleccionada.estado !==
                                                            "en camino" ||
                                                        entregaSeleccionada.total_real ===
                                                            null ||
                                                        entregaSeleccionada.total_real ===
                                                            undefined
                                                    }
                                                    onClick={() =>
                                                        handleConfirmarEntrega(
                                                            entregaSeleccionada
                                                        )
                                                    }
                                                >

                                                    <i className="bi bi-check-circle me-2"></i>

                                                    Confirmar entrega

                                                </button>


                                                {(
                                                    entregaSeleccionada.estado !==
                                                        "en camino" ||
                                                    entregaSeleccionada.total_real ===
                                                        null ||
                                                    entregaSeleccionada.total_real ===
                                                        undefined
                                                ) && (

                                                    <small className="text-muted d-block mt-2">

                                                        Confirma el total real y coloca el pedido En camino antes de entregarlo.

                                                    </small>

                                                )}

                                            </div>


                                            {/* CANCELACIÓN - ACCIÓN SECUNDARIA */}

                                            {(
                                                entregaSeleccionada.estado === "aceptado" ||
                                                entregaSeleccionada.estado === "en camino"
                                            ) && (

                                                <div className="border-top mt-4 pt-3 text-center">

                                                    <button
                                                        type="button"
                                                        className="btn btn-link text-danger text-decoration-none btn-sm px-3"
                                                        onClick={() =>
                                                            handleCancelarPedido(
                                                                entregaSeleccionada
                                                            )
                                                        }
                                                    >
                                                        <i className="bi bi-trash3 me-2"></i>
                                                        Cancelar pedido
                                                    </button>

                                                    <small className="text-muted d-block mt-1">
                                                        Usa esta opción solo si no puedes continuar con la entrega.
                                                    </small>

                                                </div>

                                            )}

                                        </div>

                                    </div>




                                </>

                            )}

                        </div>

                    </div>

                )}


                {/* ======================================
                    HISTORIAL
                ====================================== */}

                {vista === "historial" && (

                    <div className="row g-3">


                        <div className="col-12 col-xl-5">

                            <div className="card border-0 shadow-sm rounded-4">

                                <div className="card-body p-3 p-md-4">

                                    <h4 className="fw-bold fs-5 mb-3">

                                        Entregas finalizadas

                                    </h4>


                                    {entregasFinalizadas.length ===
                                    0 ? (

                                        <p className="text-muted text-center py-4">

                                            Aún no tienes entregas finalizadas.

                                        </p>

                                    ) : (

                                        entregasFinalizadas.map(
                                            (pedido) => (

                                                <button
                                                    type="button"
                                                    key={pedido.id}
                                                    className={`card w-100 text-start rounded-4 mb-2 adomi-driver__delivery-card ${
                                                        historialSeleccionado?.id ===
                                                        pedido.id
                                                            ? "border-success"
                                                            : "border"
                                                    }`}
                                                    onClick={() =>
                                                        setHistorialSeleccionado((actual) =>
                                                            actual?.id === pedido.id ? null : pedido
                                                        )
                                                    }
                                                >

                                                    <div className="card-body p-3">

                                                        <div className="d-flex justify-content-between">

                                                            <div>

                                                                <strong>

                                                                    Pedido #{pedido.id}

                                                                </strong>


                                                                <div className="small text-muted">

                                                                    {pedido.cliente_nombre}

                                                                </div>

                                                            </div>


                                                            <span
                                                                className={getEstadoBadge(
                                                                    pedido.estado
                                                                )}
                                                            >

                                                                {pedido.estado}

                                                            </span>

                                                        </div>


                                                        <div className="small mt-2">

                                                            Total:{" "}

                                                            {formatoDinero(
                                                                pedido.total_real ??
                                                                    pedido.total
                                                            )}

                                                        </div>

                                                    </div>

                                                </button>

                                            )
                                        )

                                    )}

                                </div>

                            </div>

                        </div>


                        <div className="col-12 col-xl-7">

                            {!historialSeleccionado ? (

                                <div className="card border-0 shadow-sm rounded-4">

                                    <div className="card-body text-center py-5">

                                        <i className="bi bi-receipt fs-1 text-muted"></i>


                                        <p className="text-muted mt-3 mb-0">

                                            Selecciona una entrega finalizada.

                                        </p>

                                    </div>

                                </div>

                            ) : (

                                <div className="card border-0 shadow-sm rounded-4">

                                    <div className="card-body p-3 p-md-4">

                                                                                <button type="button" className="btn btn-link adomi-driver__back-mobile p-0 mb-3 text-decoration-none" onClick={() => setHistorialSeleccionado(null)}>
                                            <i className="bi bi-arrow-left me-2"></i>Volver al historial
                                        </button>

<h4 className="fw-bold fs-5 mb-3">

                                            Detalle de entrega

                                        </h4>


                                        <p>

                                            <strong>
                                                Pedido:
                                            </strong>{" "}

                                            #{historialSeleccionado.id}

                                        </p>


                                        <p>

                                            <strong>
                                                Cliente:
                                            </strong>{" "}

                                            {historialSeleccionado.cliente_nombre}

                                        </p>


                                        {historialSeleccionado.lugar_compra && (
                                            <p>
                                                <strong>
                                                    Lugar de recogida:
                                                </strong>{" "}
                                                {historialSeleccionado.lugar_compra}
                                            </p>
                                        )}


                                        <p>

                                            <strong>
                                                Estado:
                                            </strong>{" "}

                                            <span
                                                className={getEstadoBadge(
                                                    historialSeleccionado.estado
                                                )}
                                            >

                                                {historialSeleccionado.estado}

                                            </span>

                                        </p>


                                        <p>

                                            <strong>
                                                Total:
                                            </strong>{" "}

                                            {formatoDinero(
                                                historialSeleccionado.total_real ??
                                                    historialSeleccionado.total
                                            )}

                                        </p>


                                        <p>

                                            <strong>
                                                Observación:
                                            </strong>{" "}

                                            {historialSeleccionado.observacion_entrega ||
                                                "Sin observación"}

                                        </p>


                                        <p>

                                            <strong>
                                                Fecha:
                                            </strong>{" "}

                                            {historialSeleccionado.fecha_entrega
                                                ? new Date(
                                                      historialSeleccionado.fecha_entrega
                                                  ).toLocaleString()
                                                : "Sin fecha"}

                                        </p>


                                        <div>

                                            <strong>
                                                Confirmación cliente:
                                            </strong>{" "}

                                            {getConfirmacionCliente(
                                                historialSeleccionado
                                            )}

                                        </div>


                                        {historialSeleccionado.comentario_cliente && (

                                            <div className="alert alert-light border mt-3 mb-0">

                                                <strong>
                                                    Comentario:
                                                </strong>{" "}

                                                {historialSeleccionado.comentario_cliente}

                                            </div>

                                        )}

                                    </div>

                                </div>

                            )}

                        </div>

                    </div>

                )}


                {panelPedido && entregaSeleccionada && (
                    <div className="adomi-driver__overlay" onMouseDown={() => setPanelPedido(null)}>
                        <div className="adomi-driver__modal" onMouseDown={(e) => e.stopPropagation()}>
                            <div className="adomi-driver__modal-header">
                                <div><small className="text-muted">Pedido #{entregaSeleccionada.id}</small><h5 className="fw-bold mb-0">{panelPedido === "mapa" ? "Ubicación de entrega" : "Chat con cliente"}</h5></div>
                                <button type="button" className="btn-close" aria-label="Cerrar" onClick={() => setPanelPedido(null)}></button>
                            </div>
                            <div className="adomi-driver__modal-body">
                                {panelPedido === "mapa" && tieneUbicacionCliente(entregaSeleccionada) && (
                                    <DeliveryMap cliente={{latitud: entregaSeleccionada.cliente_latitud, longitud: entregaSeleccionada.cliente_longitud}} repartidor={ubicacionActiva && ultimaUbicacion?.latitud !== undefined && ultimaUbicacion?.longitud !== undefined ? {latitud: ultimaUbicacion.latitud, longitud: ultimaUbicacion.longitud} : null} titulo="Punto exacto de entrega" mostrarRuta={true} altura="min(58vh, 520px)" />
                                )}
                                {panelPedido === "chat" && <OrderChat pedidoId={entregaSeleccionada.id} />}
                            </div>
                        </div>
                    </div>
                )}

                </main>

                <nav className="adomi-driver__bottom-nav" aria-label="Navegación del repartidor">
                    <button type="button" className={vista === "pendientes" ? "active" : ""} onClick={() => setVista("pendientes")}>
                        <i className="bi bi-hourglass-split"></i><span>Disponibles</span>
                    </button>
                    <button type="button" className={vista === "activa" ? "active" : ""} onClick={() => setVista("activa")}>
                        <i className="bi bi-truck"></i><span>Entregas</span>
                        {entregasActivas.length > 0 && <b>{entregasActivas.length}</b>}
                    </button>
                    <button type="button" className={vista === "historial" ? "active" : ""} onClick={() => setVista("historial")}>
                        <i className="bi bi-clock-history"></i><span>Historial</span>
                    </button>
                </nav>

            </div>


            {/* ==========================================
                MODAL CONFIRMACIÓN TOTAL
            ========================================== */}

            {confirmacionTotal && (

                <div
                    className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3"
                    style={{
                        backgroundColor:
                            "rgba(0,0,0,0.55)",
                        zIndex: 2000
                    }}
                >

                    <div
                        className="card border-0 shadow-lg rounded-4 w-100"
                        style={{
                            maxWidth: "460px"
                        }}
                    >

                        <div className="card-body p-4">


                            <div className="text-center mb-4">

                                <div className="fs-1 mb-2">

                                    <i className="bi bi-cash-coin text-primary"></i>

                                </div>


                                <h4 className="fw-bold">

                                    ¿Confirmar total real?

                                </h4>


                                <p className="text-muted mb-0">

                                    Revisa cuidadosamente la cantidad antes de continuar.

                                </p>

                            </div>


                            <div className="bg-light rounded-4 p-3 mb-3">


                                <div className="d-flex justify-content-between mb-2">

                                    <span className="text-muted">

                                        Total estimado

                                    </span>


                                    <strong>

                                        {formatoDinero(
                                            confirmacionTotal.totalEstimado
                                        )}

                                    </strong>

                                </div>


                                <div className="d-flex justify-content-between mb-2">

                                    <span className="text-muted">

                                        Total real

                                    </span>


                                    <strong className="fs-5">

                                        {formatoDinero(
                                            confirmacionTotal.totalReal
                                        )}

                                    </strong>

                                </div>


                                <hr />


                                <div className="d-flex justify-content-between">

                                    <span>

                                        Diferencia

                                    </span>


                                    <strong
                                        className={
                                            confirmacionTotal.diferencia >
                                            0
                                                ? "text-danger"
                                                : confirmacionTotal.diferencia <
                                                  0
                                                ? "text-success"
                                                : ""
                                        }
                                    >

                                        {confirmacionTotal.diferencia >
                                        0
                                            ? "+"
                                            : ""}

                                        {formatoDinero(
                                            confirmacionTotal.diferencia
                                        )}

                                    </strong>

                                </div>

                            </div>


                            <div className="alert alert-warning small">

                                <i className="bi bi-exclamation-triangle me-2"></i>

                                <strong>
                                    Importante:
                                </strong>{" "}

                                después de confirmar el total real no podrás modificar esta cantidad.

                            </div>


                            <div className="d-grid gap-2">

                                <button
                                    type="button"
                                    className="btn btn-primary py-2"
                                    disabled={guardandoTotal}
                                    onClick={
                                        guardarTotalConfirmado
                                    }
                                >

                                    {guardandoTotal ? (

                                        <>

                                            <span className="spinner-border spinner-border-sm me-2"></span>

                                            Guardando...

                                        </>

                                    ) : (

                                        <>

                                            <i className="bi bi-check-circle me-2"></i>

                                            Sí, confirmar cantidad

                                        </>

                                    )}

                                </button>


                                <button
                                    type="button"
                                    className="btn btn-light"
                                    disabled={guardandoTotal}
                                    onClick={() =>
                                        setConfirmacionTotal(
                                            null
                                        )
                                    }
                                >

                                    Revisar nuevamente

                                </button>

                            </div>

                        </div>

                    </div>

                </div>

            )}

        </div>
    );
}


export default RepartidorDashboard;