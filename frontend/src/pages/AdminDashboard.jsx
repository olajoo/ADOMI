import { useEffect, useRef, useState } from "react";

import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell
} from "recharts";

import {
    getDashboardStats,
    getAllUsers,
    updateUserStatus,
    createDeliveryUser,
    createAdminUser,
    getAllOrdersAdmin,
    resolveOrderIncident,
    correctCancelledOrder
} from "../services/adminService";

import { reactivateCancelledOrder } from "../services/orderService";

import socket from "../socket";
import "./AdminDashboard.css";

function AdminDashboard() {
    const joinedOrderRoomsRef = useRef(new Set());
    const user = JSON.parse(localStorage.getItem("user"));

    const [vista, setVista] = useState("resumen");
    const [stats, setStats] = useState(null);
    const [usuarios, setUsuarios] = useState([]);
    const [pedidos, setPedidos] = useState([]);

    const [mensaje, setMensaje] = useState("");
    const [error, setError] = useState("");

    const [nombreRepartidor, setNombreRepartidor] = useState("");
    const [correoRepartidor, setCorreoRepartidor] = useState("");
    const [passwordRepartidor, setPasswordRepartidor] = useState("");

    const [nombreAdmin, setNombreAdmin] = useState("");
    const [correoAdmin, setCorreoAdmin] = useState("");
    const [passwordAdmin, setPasswordAdmin] = useState("");
    const [creandoAdmin, setCreandoAdmin] = useState(false);

    const [repartidorSeleccionado, setRepartidorSeleccionado] = useState({});

    const [pedidoDetalle, setPedidoDetalle] = useState(null);
    const [resolucionIncidencia, setResolucionIncidencia] = useState("");
    const [resolviendoIncidencia, setResolviendoIncidencia] = useState(false);

    const [editandoPedido, setEditandoPedido] = useState(false);
    const [guardandoCorreccion, setGuardandoCorreccion] = useState(false);
    const [datosCorreccion, setDatosCorreccion] = useState({
        lugar_compra: "",
        descripcion: "",
        direccion: "",
        telefono_contacto: "",
        total: ""
    });

    const clientes = usuarios.filter((u) => u.rol === "cliente");
    const repartidores = usuarios.filter((u) => u.rol === "repartidor");
    const admins = usuarios.filter((u) => u.rol === "admin");

    const pedidosPendientes = pedidos.filter((p) => p.estado === "pendiente");
    const pedidosActivos = pedidos.filter(
        (p) => p.estado === "aceptado" || p.estado === "en camino"
    );
    const pedidosFinalizados = pedidos.filter(
        (p) => p.estado === "entregado" || p.estado === "cancelado"
    );

    const pedidosCancelados = pedidos.filter(
        (p) => p.estado === "cancelado"
    );

    const incidenciasPendientes = pedidos.filter(
        (p) =>
            p.confirmacion_cliente === "problema" &&
            Number(p.incidencia_resuelta) !== 1
    );

    const pedidosChartData = stats ? [
        { name: "Pendientes", cantidad: stats.pedidos_pendientes || 0, color: "#6c757d" },
        { name: "Aceptados", cantidad: stats.pedidos_aceptados || 0, color: "#0d6efd" },
        { name: "En camino", cantidad: stats.pedidos_en_camino || 0, color: "#ffc107" },
        { name: "Entregados", cantidad: stats.pedidos_entregados || 0, color: "#198754" },
        { name: "Cancelados", cantidad: stats.pedidos_cancelados || 0, color: "#dc3545" }
    ] : [];

    const usuariosChartData = [
        { name: "Clientes", value: clientes.length, color: "#0d6efd" },
        { name: "Repartidores", value: repartidores.length, color: "#198754" },
        { name: "Admins", value: admins.length, color: "#212529" }
    ];

    const cargarDashboard = async () => {
        try {
            const statsData = await getDashboardStats();
            const usuariosData = await getAllUsers();
            const pedidosData = await getAllOrdersAdmin();

            setStats(statsData.stats);
            setUsuarios(usuariosData.usuarios || []);
            setPedidos(pedidosData.pedidos || []);
        } catch (error) {
            setError("No se pudo cargar la información del administrador");
        }
    };

    useEffect(() => {
        cargarDashboard();

        const interval = setInterval(() => {
            cargarDashboard();
        }, 10000);

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
                        ? { ...pedido, ...pedidoActualizado }
                        : pedido
                )
            );

            setMensaje(`Pedido #${pedidoActualizado.id} actualizado`);

            setTimeout(() => {
                setMensaje("");
            }, 3000);
        });

        return () => {
            socket.off("pedidoActualizado");
        };
    }, []);

    const cerrarSesion = () => {
        localStorage.clear();
        window.location.href = "/";
    };

    const handleCambiarEstado = async (usuario) => {
        setMensaje("");
        setError("");

        const nuevoEstado = usuario.estado === "activo" ? "inactivo" : "activo";

        try {
            await updateUserStatus(usuario.id, nuevoEstado);
            setMensaje("Estado actualizado correctamente");
            await cargarDashboard();
        } catch (error) {
            setError(
                error.response?.data?.message ||
                "Error al cambiar estado del usuario"
            );
        }
    };

    const handleCrearRepartidor = async (e) => {
        e.preventDefault();

        setMensaje("");
        setError("");

        try {
            await createDeliveryUser(
                nombreRepartidor,
                correoRepartidor,
                passwordRepartidor
            );

            setMensaje("Repartidor creado correctamente");

            setNombreRepartidor("");
            setCorreoRepartidor("");
            setPasswordRepartidor("");

            await cargarDashboard();
            setVista("repartidores");
        } catch (error) {
            setError(
                error.response?.data?.message ||
                "Error al crear repartidor"
            );
        }
    };

    const handleCrearAdmin = async (e) => {
        e.preventDefault();

        setMensaje("");
        setError("");

        const nombre = nombreAdmin.trim();
        const correo = correoAdmin.trim().toLowerCase();

        if (nombre.length < 2 || nombre.length > 100) {
            setError("El nombre debe tener entre 2 y 100 caracteres");
            return;
        }

        if (!correo) {
            setError("El correo es obligatorio");
            return;
        }

        if (passwordAdmin.length < 8 || passwordAdmin.length > 72) {
            setError("La contraseña debe tener entre 8 y 72 caracteres");
            return;
        }

        try {
            setCreandoAdmin(true);

            await createAdminUser(
                nombre,
                correo,
                passwordAdmin
            );

            setMensaje("Administrador creado correctamente");
            setNombreAdmin("");
            setCorreoAdmin("");
            setPasswordAdmin("");

            await cargarDashboard();
            setVista("administradores");
        } catch (error) {
            setError(
                error.response?.data?.message ||
                "Error al crear administrador"
            );
        } finally {
            setCreandoAdmin(false);
        }
    };

    const handleReactivarPedido = async (pedido) => {
        setMensaje("");
        setError("");

        const repartidorId = repartidorSeleccionado[pedido.id];

        if (!repartidorId) {
            setError("Debe seleccionar un repartidor para reactivar el pedido");
            return;
        }

        try {
            await reactivateCancelledOrder(pedido.id, repartidorId);

            setMensaje("Pedido reactivado correctamente");

            setRepartidorSeleccionado({
                ...repartidorSeleccionado,
                [pedido.id]: ""
            });

            await cargarDashboard();
        } catch (error) {
            setError(
                error.response?.data?.message ||
                "Error al reactivar pedido"
            );
        }
    };

    const cargarDatosCorreccion = (pedido) => {
        setDatosCorreccion({
            lugar_compra: pedido?.lugar_compra || "",
            descripcion: pedido?.descripcion || "",
            direccion: pedido?.direccion || "",
            telefono_contacto: pedido?.telefono_contacto || "",
            total: pedido?.total ?? ""
        });
    };

    const abrirDetallePedido = (pedido) => {
        setPedidoDetalle(pedido);
        setResolucionIncidencia(pedido.resolucion_admin || "");
        setEditandoPedido(false);
        cargarDatosCorreccion(pedido);
        setError("");
    };

    const cerrarDetallePedido = () => {
        if (resolviendoIncidencia || guardandoCorreccion) return;
        setPedidoDetalle(null);
        setResolucionIncidencia("");
        setEditandoPedido(false);
    };

    const iniciarCorreccion = () => {
        if (!pedidoDetalle || pedidoDetalle.estado !== "cancelado") return;
        cargarDatosCorreccion(pedidoDetalle);
        setEditandoPedido(true);
        setError("");
        setMensaje("");
    };

    const cancelarCorreccion = () => {
        cargarDatosCorreccion(pedidoDetalle);
        setEditandoPedido(false);
        setError("");
    };

    const handleCambioCorreccion = (campo, valor) => {
        setDatosCorreccion((prev) => ({ ...prev, [campo]: valor }));
    };

    const handleTelefonoCorreccion = (valor) => {
        const digitos = valor.replace(/\D/g, "").slice(0, 8);
        const formateado = digitos.length > 4
            ? `${digitos.slice(0, 4)}-${digitos.slice(4)}`
            : digitos;

        handleCambioCorreccion("telefono_contacto", formateado);
    };

    const handleGuardarCorreccion = async () => {
        if (!pedidoDetalle || pedidoDetalle.estado !== "cancelado") return;

        const lugarCompra = datosCorreccion.lugar_compra.trim();
        const descripcion = datosCorreccion.descripcion.trim();
        const direccion = datosCorreccion.direccion.trim();
        const telefonoDigitos = datosCorreccion.telefono_contacto.replace(/\D/g, "");
        const totalNumero = Number(datosCorreccion.total);

        if (lugarCompra.length < 2 || lugarCompra.length > 150) {
            setError("El lugar de compra debe tener entre 2 y 150 caracteres");
            return;
        }

        if (!descripcion || !direccion) {
            setError("Descripción y dirección son obligatorias");
            return;
        }

        if (telefonoDigitos.length !== 8) {
            setError("El teléfono debe contener exactamente 8 dígitos");
            return;
        }

        if (!Number.isFinite(totalNumero) || totalNumero <= 0) {
            setError("El total estimado debe ser mayor a Q 0.00");
            return;
        }

        const telefonoFormateado =
            `${telefonoDigitos.slice(0, 4)}-${telefonoDigitos.slice(4)}`;

        try {
            setGuardandoCorreccion(true);
            setError("");
            setMensaje("");

            await correctCancelledOrder(pedidoDetalle.id, {
                lugar_compra: lugarCompra,
                descripcion,
                direccion,
                telefono_contacto: telefonoFormateado,
                total: totalNumero
            });

            const actualizado = {
                ...pedidoDetalle,
                lugar_compra: lugarCompra,
                descripcion,
                direccion,
                telefono_contacto: telefonoFormateado,
                total: totalNumero
            };

            setPedidoDetalle(actualizado);
            setEditandoPedido(false);
            setMensaje(`Pedido #${pedidoDetalle.id} corregido correctamente`);
            await cargarDashboard();
        } catch (error) {
            setError(
                error.response?.data?.message ||
                "Error al corregir el pedido"
            );
        } finally {
            setGuardandoCorreccion(false);
        }
    };

    const handleResolverIncidencia = async () => {
        if (!pedidoDetalle) return;

        const resolucion = resolucionIncidencia.trim();

        if (resolucion.length < 5) {
            setError("La resolución debe contener al menos 5 caracteres");
            return;
        }

        if (resolucion.length > 500) {
            setError("La resolución no puede superar los 500 caracteres");
            return;
        }

        try {
            setResolviendoIncidencia(true);
            setError("");

            await resolveOrderIncident(pedidoDetalle.id, resolucion);
            await cargarDashboard();

            setPedidoDetalle((prev) => ({
                ...prev,
                incidencia_resuelta: 1,
                resolucion_admin: resolucion,
                fecha_resolucion: new Date().toISOString()
            }));

            setMensaje(`Incidencia del pedido #${pedidoDetalle.id} resuelta correctamente`);
        } catch (error) {
            setError(
                error.response?.data?.message ||
                "Error al resolver la incidencia"
            );
        } finally {
            setResolviendoIncidencia(false);
        }
    };

    const formatearFecha = (fecha) => {
        if (!fecha) return "Pendiente";
        return new Date(fecha).toLocaleString();
    };

    const formatearDinero = (valor) => {
        if (valor === null || valor === undefined || valor === "") return "Pendiente";
        return `Q ${Number(valor).toFixed(2)}`;
    };

    const getEstadoBadge = (estado) => {
        if (estado === "activo") return "badge bg-success";
        if (estado === "inactivo") return "badge bg-danger";
        if (estado === "pendiente") return "badge bg-secondary";
        if (estado === "aceptado") return "badge bg-primary";
        if (estado === "en camino") return "badge bg-warning text-dark";
        if (estado === "entregado") return "badge bg-success";
        if (estado === "cancelado") return "badge bg-danger";

        return "badge bg-dark";
    };

    const getRolBadge = (rol) => {
        if (rol === "admin") return "badge bg-dark";
        if (rol === "cliente") return "badge bg-primary";
        if (rol === "repartidor") return "badge bg-warning text-dark";

        return "badge bg-secondary";
    };

    const getConfirmacionClienteBadge = (confirmacion) => {
        if (confirmacion === "confirmado") {
            return <span className="badge bg-success">Confirmado</span>;
        }

        if (confirmacion === "problema") {
            return <span className="badge bg-danger">Problema</span>;
        }

        return <span className="badge bg-secondary">Pendiente</span>;
    };

    const mostrarDiferencia = (diferencia) => {
        if (diferencia === null || diferencia === undefined) {
            return "Pendiente";
        }

        if (Number(diferencia) > 0) {
            return <span className="text-danger fw-bold">+ Q {diferencia}</span>;
        }

        if (Number(diferencia) < 0) {
            return <span className="text-success fw-bold">Q {diferencia}</span>;
        }

        return <span className="text-secondary fw-bold">Q 0.00</span>;
    };

    const getCodigoVisualUsuario = (usuario, index) => {
        if (usuario.rol === "cliente") return `CLI-${index + 1}`;
        if (usuario.rol === "repartidor") return `REP-${index + 1}`;
        if (usuario.rol === "admin") return `ADM-${index + 1}`;
        return `USR-${index + 1}`;
    };

    const TablaUsuarios = ({ data }) => (
        <div>
            <div className="table-responsive d-none d-md-block adomi-admin__table-wrap">
                <table className="table align-middle mb-0">
                    <thead>
                        <tr>
                            <th>Código</th>
                            <th>ID real</th>
                            <th>Nombre</th>
                            <th>Correo</th>
                            <th>Rol</th>
                            <th>Estado</th>
                            <th>Acción</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((usuario, index) => (
                            <tr key={usuario.id}>
                                <td>
                                    <span className="badge bg-dark">
                                        {getCodigoVisualUsuario(usuario, index)}
                                    </span>
                                </td>
                                <td>#{usuario.id}</td>
                                <td className="fw-semibold">{usuario.nombre}</td>
                                <td>{usuario.correo}</td>
                                <td><span className={getRolBadge(usuario.rol)}>{usuario.rol}</span></td>
                                <td>
                                    <span className={getEstadoBadge(usuario.estado || "activo")}>
                                        {usuario.estado || "activo"}
                                    </span>
                                </td>
                                <td>
                                    <button
                                        className={usuario.estado === "inactivo"
                                            ? "btn btn-success btn-sm"
                                            : "btn btn-outline-danger btn-sm"}
                                        onClick={() => handleCambiarEstado(usuario)}
                                    >
                                        {usuario.estado === "inactivo" ? "Activar" : "Desactivar"}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="d-md-none adomi-admin__user-list">
                {data.map((usuario, index) => (
                    <div className="adomi-admin__user-card" key={usuario.id}>
                        <div className="d-flex justify-content-between align-items-start gap-2">
                            <div className="min-w-0">
                                <div className="d-flex align-items-center flex-wrap gap-2 mb-1">
                                    <span className="badge bg-dark">
                                        {getCodigoVisualUsuario(usuario, index)}
                                    </span>
                                    <span className={getEstadoBadge(usuario.estado || "activo")}>
                                        {usuario.estado || "activo"}
                                    </span>
                                </div>
                                <div className="fw-bold text-truncate">{usuario.nombre}</div>
                                <div className="text-muted small text-break">{usuario.correo}</div>
                            </div>
                            <span className={getRolBadge(usuario.rol)}>{usuario.rol}</span>
                        </div>
                        <div className="d-flex justify-content-between align-items-center gap-2 mt-3 pt-3 border-top">
                            <small className="text-muted">ID #{usuario.id}</small>
                            <button
                                className={usuario.estado === "inactivo"
                                    ? "btn btn-success btn-sm"
                                    : "btn btn-outline-danger btn-sm"}
                                onClick={() => handleCambiarEstado(usuario)}
                            >
                                {usuario.estado === "inactivo" ? "Activar" : "Desactivar"}
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    const TablaPedidos = ({ data }) => (
        <div>
            {/* Vista de escritorio */}
            <div className="table-responsive d-none d-md-block">
                <table className="table align-middle mb-0">
                    <thead>
                        <tr>
                            <th>Cliente</th>
                            <th>Repartidor</th>
                            <th>Recoger en</th>
                            <th>Estado</th>
                            <th style={{ width: "190px" }}>Acción</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((pedido) => {
                            const tieneProblema = pedido.confirmacion_cliente === "problema";
                            const incidenciaResuelta = Number(pedido.incidencia_resuelta) === 1;

                            return (
                                <tr
                                    key={pedido.id}
                                    className={tieneProblema && !incidenciaResuelta ? "table-danger" : ""}
                                >
                                    <td>
                                        <div className="fw-semibold">{pedido.cliente_nombre}</div>
                                        <small className="text-muted">Pedido #{pedido.id}</small>
                                    </td>
                                    <td>{pedido.repartidor_nombre || "Sin asignar"}</td>
                                    <td>{pedido.lugar_compra || "No registrado"}</td>
                                    <td>
                                        <span className={getEstadoBadge(pedido.estado)}>
                                            {pedido.estado}
                                        </span>
                                        {tieneProblema && !incidenciaResuelta && (
                                            <span className="badge bg-danger ms-2">Problema</span>
                                        )}
                                        {tieneProblema && incidenciaResuelta && (
                                            <span className="badge bg-success ms-2">Resuelto</span>
                                        )}
                                    </td>
                                    <td>
                                        <button
                                            className={`btn btn-sm w-100 ${
                                                pedido.estado === "cancelado"
                                                    ? "btn-outline-danger"
                                                    : tieneProblema && !incidenciaResuelta
                                                        ? "btn-danger"
                                                        : "btn-outline-dark"
                                            }`}
                                            onClick={() => abrirDetallePedido(pedido)}
                                        >
                                            <i className="bi bi-eye me-1"></i>
                                            {pedido.estado === "cancelado"
                                                ? "Ver / Reactivar"
                                                : tieneProblema && !incidenciaResuelta
                                                    ? "Ver / Resolver"
                                                    : "Ver detalle"}
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Vista móvil */}
            <div className="d-md-none">
                {data.map((pedido) => {
                    const tieneProblema = pedido.confirmacion_cliente === "problema";
                    const incidenciaResuelta = Number(pedido.incidencia_resuelta) === 1;

                    return (
                        <div
                            key={pedido.id}
                            className={`border rounded-4 p-3 mb-3 ${
                                tieneProblema && !incidenciaResuelta
                                    ? "border-danger bg-danger-subtle"
                                    : "bg-white"
                            }`}
                        >
                            <div className="d-flex justify-content-between align-items-start gap-2 mb-3">
                                <div>
                                    <div className="fw-bold">{pedido.cliente_nombre}</div>
                                    <small className="text-muted">Pedido #{pedido.id}</small>
                                </div>
                                <span className={getEstadoBadge(pedido.estado)}>
                                    {pedido.estado}
                                </span>
                            </div>

                            <div className="small mb-2">
                                <span className="text-muted">Repartidor: </span>
                                <span className="fw-semibold">
                                    {pedido.repartidor_nombre || "Sin asignar"}
                                </span>
                            </div>
                            <div className="small mb-3">
                                <span className="text-muted">Recoger en: </span>
                                <span className="fw-semibold">
                                    {pedido.lugar_compra || "No registrado"}
                                </span>
                            </div>

                            {tieneProblema && !incidenciaResuelta && (
                                <div className="alert alert-danger py-2 px-3 small mb-3">
                                    <i className="bi bi-exclamation-triangle-fill me-2"></i>
                                    Requiere atención del administrador
                                </div>
                            )}

                            {tieneProblema && incidenciaResuelta && (
                                <div className="text-success small fw-semibold mb-3">
                                    <i className="bi bi-check-circle-fill me-2"></i>
                                    Incidencia resuelta
                                </div>
                            )}

                            <button
                                className={`btn w-100 ${
                                    pedido.estado === "cancelado"
                                        ? "btn-outline-danger"
                                        : tieneProblema && !incidenciaResuelta
                                            ? "btn-danger"
                                            : "btn-outline-dark"
                                }`}
                                onClick={() => abrirDetallePedido(pedido)}
                            >
                                <i className="bi bi-eye me-1"></i>
                                {pedido.estado === "cancelado"
                                    ? "Ver detalle / Reactivar"
                                    : tieneProblema && !incidenciaResuelta
                                        ? "Ver detalle / Resolver"
                                        : "Ver detalle"}
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );

    return (
        <div className="min-vh-100 bg-light adomi-admin">

            <nav className="navbar navbar-expand-lg navbar-dark bg-dark shadow-sm adomi-admin__navbar">
                <div className="container-fluid px-4">
                    <span className="navbar-brand fw-bold">
                        <i className="bi bi-speedometer2 me-2"></i>
                        ADOMI Admin
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

            <main className="container-fluid px-3 px-md-4 py-3 py-md-4 adomi-admin__main">

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
                    <div className="card-body p-3 p-md-4">
                        <h2 className="fw-bold mb-1">
                            Panel de Administración
                        </h2>

                        <p className="text-muted mb-0">
                            Control general de usuarios, repartidores, pedidos, estadísticas y reactivación de pedidos cancelados.
                        </p>
                    </div>
                </div>

                <div className="row g-3 mb-4">

                    <div className="col-12 col-md-6 col-xl">
                        <button
                            className={`card border-0 shadow-sm rounded-4 w-100 text-start adomi-admin__nav-card ${
                                vista === "resumen" ? "adomi-admin__nav-card--active" : ""
                            }`}
                            onClick={() => setVista("resumen")}
                        >
                            <div className="card-body p-3 p-md-4">
                                <div className="fs-1 text-dark mb-2">
                                    <i className="bi bi-bar-chart"></i>
                                </div>

                                <h5 className="fw-bold">Resumen</h5>

                                <p className="text-muted mb-0">
                                    Estadísticas generales.
                                </p>
                            </div>
                        </button>
                    </div>

                    <div className="col-12 col-md-6 col-xl">
                        <button
                            className={`card border-0 shadow-sm rounded-4 w-100 text-start adomi-admin__nav-card ${
                                vista === "clientes" ? "adomi-admin__nav-card--active" : ""
                            }`}
                            onClick={() => setVista("clientes")}
                        >
                            <div className="card-body p-3 p-md-4">
                                <div className="fs-1 text-primary mb-2">
                                    <i className="bi bi-people"></i>
                                </div>

                                <h5 className="fw-bold">Clientes</h5>

                                <p className="text-muted mb-0">
                                    {clientes.length} registrado(s).
                                </p>
                            </div>
                        </button>
                    </div>

                    <div className="col-12 col-md-6 col-xl">
                        <button
                            className={`card border-0 shadow-sm rounded-4 w-100 text-start adomi-admin__nav-card ${
                                vista === "repartidores" ? "adomi-admin__nav-card--active" : ""
                            }`}
                            onClick={() => setVista("repartidores")}
                        >
                            <div className="card-body p-3 p-md-4">
                                <div className="fs-1 text-warning mb-2">
                                    <i className="bi bi-truck"></i>
                                </div>

                                <h5 className="fw-bold">Repartidores</h5>

                                <p className="text-muted mb-0">
                                    {repartidores.length} registrado(s).
                                </p>
                            </div>
                        </button>
                    </div>

                    <div className="col-12 col-md-6 col-xl">
                        <button
                            className={`card border-0 shadow-sm rounded-4 w-100 text-start adomi-admin__nav-card ${
                                vista === "administradores" ? "adomi-admin__nav-card--active" : ""
                            }`}
                            onClick={() => setVista("administradores")}
                        >
                            <div className="card-body p-3 p-md-4">
                                <div className="fs-1 text-dark mb-2">
                                    <i className="bi bi-shield-lock"></i>
                                </div>

                                <h5 className="fw-bold">Administradores</h5>

                                <p className="text-muted mb-0">
                                    {admins.length} registrado(s).
                                </p>
                            </div>
                        </button>
                    </div>

                    <div className="col-12 col-md-6 col-xl">
                        <button
                            className={`card border-0 shadow-sm rounded-4 w-100 text-start adomi-admin__nav-card ${
                                vista === "pedidos" ? "adomi-admin__nav-card--active" : ""
                            }`}
                            onClick={() => setVista("pedidos")}
                        >
                            <div className="card-body p-3 p-md-4">
                                <div className="fs-1 text-success mb-2">
                                    <i className="bi bi-bag-check"></i>
                                </div>

                                <h5 className="fw-bold">Pedidos</h5>

                                <p className="text-muted mb-0">
                                    {pedidos.length} registrado(s).
                                </p>
                            </div>
                        </button>
                    </div>

                    <div className="col-12 col-md-6 col-xl">
                        <button
                            className={`card border-0 shadow-sm rounded-4 w-100 text-start adomi-admin__nav-card ${
                                vista === "incidencias" ? "adomi-admin__nav-card--active adomi-admin__nav-card--danger" : ""
                            }`}
                            onClick={() => setVista("incidencias")}
                        >
                            <div className="card-body p-3 p-md-4">
                                <div className="fs-1 text-danger mb-2">
                                    <i className="bi bi-exclamation-triangle"></i>
                                </div>
                                <h5 className="fw-bold">Incidencias</h5>
                                <p className="text-muted mb-0">
                                    {incidenciasPendientes.length} pendiente(s).
                                </p>
                            </div>
                        </button>
                    </div>

                </div>

                {vista === "resumen" && (
                    <>
                        <div className="row g-3 mb-4">

                            <div className="col-6 col-xl-3">
                                <div className="card border-0 shadow-sm rounded-4 h-100">
                                    <div className="card-body p-3 p-md-4">
                                        <div className="d-flex justify-content-between align-items-start gap-2">
                                            <div>
                                                <p className="text-muted small mb-1">Pedidos</p>
                                                <h3 className="fw-bold mb-0">{pedidos.length}</h3>
                                            </div>
                                            <i className="bi bi-bag-check fs-4 text-primary"></i>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="col-6 col-xl-3">
                                <div className="card border-0 shadow-sm rounded-4 h-100">
                                    <div className="card-body p-3 p-md-4">
                                        <div className="d-flex justify-content-between align-items-start gap-2">
                                            <div>
                                                <p className="text-muted small mb-1">Activos</p>
                                                <h3 className="fw-bold mb-0">{pedidosActivos.length}</h3>
                                            </div>
                                            <i className="bi bi-truck fs-4 text-success"></i>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="col-6 col-xl-3">
                                <button
                                    type="button"
                                    className="card border-0 shadow-sm rounded-4 h-100 w-100 text-start"
                                    onClick={() => setVista("pedidos")}
                                >
                                    <div className="card-body p-3 p-md-4">
                                        <div className="d-flex justify-content-between align-items-start gap-2">
                                            <div>
                                                <p className="text-muted small mb-1">Cancelados</p>
                                                <h3 className="fw-bold text-danger mb-0">{pedidosCancelados.length}</h3>
                                            </div>
                                            <i className="bi bi-x-circle fs-4 text-danger"></i>
                                        </div>
                                    </div>
                                </button>
                            </div>

                            <div className="col-6 col-xl-3">
                                <button
                                    type="button"
                                    className={`card border-0 shadow-sm rounded-4 h-100 w-100 text-start ${
                                        incidenciasPendientes.length > 0 ? "border border-danger" : ""
                                    }`}
                                    onClick={() => setVista("pedidos")}
                                >
                                    <div className="card-body p-3 p-md-4">
                                        <div className="d-flex justify-content-between align-items-start gap-2">
                                            <div>
                                                <p className="text-muted small mb-1">Incidencias</p>
                                                <h3 className={`fw-bold mb-0 ${
                                                    incidenciasPendientes.length > 0 ? "text-danger" : ""
                                                }`}>
                                                    {incidenciasPendientes.length}
                                                </h3>
                                            </div>
                                            <i className={`bi bi-exclamation-triangle fs-4 ${
                                                incidenciasPendientes.length > 0 ? "text-danger" : "text-secondary"
                                            }`}></i>
                                        </div>
                                    </div>
                                </button>
                            </div>

                        </div>

                        <div className="row g-4">

                            <div className="col-12 col-xl-7">
                                <div className="card border-0 shadow-sm rounded-4">
                                    <div className="card-body p-4">
                                        <h4 className="fw-bold mb-3">
                                            Estados de pedidos
                                        </h4>

                                        <div style={{ width: "100%", height: 280 }}>
                                            <ResponsiveContainer>
                                                <BarChart data={pedidosChartData}>
                                                    <XAxis dataKey="name" />
                                                    <YAxis allowDecimals={false} />
                                                    <Tooltip />

                                                    <Bar
                                                        dataKey="cantidad"
                                                        radius={[10, 10, 0, 0]}
                                                    >
                                                        {pedidosChartData.map((entry, index) => (
                                                            <Cell
                                                                key={`cell-${index}`}
                                                                fill={entry.color}
                                                            />
                                                        ))}
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="col-12 col-xl-5">
                                <div className="card border-0 shadow-sm rounded-4">
                                    <div className="card-body p-4">
                                        <h4 className="fw-bold mb-3">
                                            Usuarios por rol
                                        </h4>

                                        <div style={{ width: "100%", height: 280 }}>
                                            <ResponsiveContainer>
                                                <PieChart>
                                                    <Pie
                                                        data={usuariosChartData}
                                                        dataKey="value"
                                                        nameKey="name"
                                                        outerRadius={90}
                                                        label
                                                    >
                                                        {usuariosChartData.map((entry, index) => (
                                                            <Cell
                                                                key={`cell-${index}`}
                                                                fill={entry.color}
                                                            />
                                                        ))}
                                                    </Pie>

                                                    <Tooltip />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </>
                )}

                {vista === "clientes" && (
                    <div className="card border-0 shadow-sm rounded-4">
                        <div className="card-body p-4">
                            <h4 className="fw-bold mb-3">Clientes</h4>
                            <TablaUsuarios data={clientes} />
                        </div>
                    </div>
                )}

                {vista === "repartidores" && (
                    <div className="row g-4">

                        <div className="col-12 col-xl-4">
                            <div className="card border-0 shadow-sm rounded-4">
                                <div className="card-body p-4">
                                    <h4 className="fw-bold mb-3">
                                        Crear repartidor
                                    </h4>

                                    <form onSubmit={handleCrearRepartidor}>
                                        <div className="mb-3">
                                            <label className="form-label fw-semibold">
                                                Nombre
                                            </label>

                                            <input
                                                type="text"
                                                className="form-control"
                                                value={nombreRepartidor}
                                                onChange={(e) => setNombreRepartidor(e.target.value)}
                                                required
                                            />
                                        </div>

                                        <div className="mb-3">
                                            <label className="form-label fw-semibold">
                                                Correo
                                            </label>

                                            <input
                                                type="email"
                                                className="form-control"
                                                value={correoRepartidor}
                                                onChange={(e) => setCorreoRepartidor(e.target.value)}
                                                required
                                            />
                                        </div>

                                        <div className="mb-3">
                                            <label className="form-label fw-semibold">
                                                Contraseña
                                            </label>

                                            <input
                                                type="password"
                                                className="form-control"
                                                value={passwordRepartidor}
                                                onChange={(e) => setPasswordRepartidor(e.target.value)}
                                                required
                                            />
                                        </div>

                                        <button className="btn btn-warning w-100 fw-semibold">
                                            Crear repartidor
                                        </button>
                                    </form>
                                </div>
                            </div>
                        </div>

                        <div className="col-12 col-xl-8">
                            <div className="card border-0 shadow-sm rounded-4">
                                <div className="card-body p-4">
                                    <h4 className="fw-bold mb-3">
                                        Repartidores
                                    </h4>

                                    <TablaUsuarios data={repartidores} />
                                </div>
                            </div>
                        </div>

                    </div>
                )}

                {vista === "administradores" && (
                    <div className="row g-4">

                        <div className="col-12 col-xl-4">
                            <div className="card border-0 shadow-sm rounded-4">
                                <div className="card-body p-3 p-md-4">
                                    <div className="d-flex align-items-center gap-2 mb-1">
                                        <i className="bi bi-shield-lock fs-4"></i>
                                        <h4 className="fw-bold mb-0">
                                            Crear administrador
                                        </h4>
                                    </div>

                                    <p className="text-muted small mb-4">
                                        Solo un administrador autenticado puede crear otra cuenta administrativa.
                                    </p>

                                    <form onSubmit={handleCrearAdmin}>
                                        <div className="mb-3">
                                            <label className="form-label fw-semibold">
                                                Nombre
                                            </label>

                                            <input
                                                type="text"
                                                className="form-control"
                                                value={nombreAdmin}
                                                onChange={(e) => setNombreAdmin(e.target.value)}
                                                minLength="2"
                                                maxLength="100"
                                                autoComplete="name"
                                                disabled={creandoAdmin}
                                                required
                                            />
                                        </div>

                                        <div className="mb-3">
                                            <label className="form-label fw-semibold">
                                                Correo
                                            </label>

                                            <input
                                                type="email"
                                                className="form-control"
                                                value={correoAdmin}
                                                onChange={(e) => setCorreoAdmin(e.target.value)}
                                                maxLength="150"
                                                autoComplete="email"
                                                disabled={creandoAdmin}
                                                required
                                            />
                                        </div>

                                        <div className="mb-3">
                                            <label className="form-label fw-semibold">
                                                Contraseña
                                            </label>

                                            <input
                                                type="password"
                                                className="form-control"
                                                value={passwordAdmin}
                                                onChange={(e) => setPasswordAdmin(e.target.value)}
                                                minLength="8"
                                                maxLength="72"
                                                autoComplete="new-password"
                                                disabled={creandoAdmin}
                                                required
                                            />

                                            <div className="form-text">
                                                Entre 8 y 72 caracteres.
                                            </div>
                                        </div>

                                        <button
                                            type="submit"
                                            className="btn btn-dark w-100 fw-semibold"
                                            disabled={creandoAdmin}
                                        >
                                            <i className="bi bi-person-plus me-2"></i>
                                            {creandoAdmin
                                                ? "Creando..."
                                                : "Crear administrador"}
                                        </button>
                                    </form>
                                </div>
                            </div>
                        </div>

                        <div className="col-12 col-xl-8">
                            <div className="card border-0 shadow-sm rounded-4">
                                <div className="card-body p-3 p-md-4">
                                    <div className="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-2 mb-3">
                                        <div>
                                            <h4 className="fw-bold mb-1">
                                                Administradores
                                            </h4>
                                            <p className="text-muted small mb-0">
                                                {admins.length} cuenta(s) administrativa(s).
                                            </p>
                                        </div>

                                        <span className="badge bg-dark align-self-start align-self-sm-center">
                                            <i className="bi bi-shield-check me-1"></i>
                                            Acceso administrativo
                                        </span>
                                    </div>

                                    <TablaUsuarios data={admins} />
                                </div>
                            </div>
                        </div>

                    </div>
                )}

                {vista === "pedidos" && (
                    <>
                        <div className="row g-3 mb-4">

                            <div className="col-12 col-md-4">
                                <div className="card border-0 shadow-sm rounded-4">
                                    <div className="card-body">
                                        <p className="text-muted mb-1">Pendientes</p>
                                        <h3 className="fw-bold">
                                            {pedidosPendientes.length}
                                        </h3>
                                    </div>
                                </div>
                            </div>

                            <div className="col-12 col-md-4">
                                <div className="card border-0 shadow-sm rounded-4">
                                    <div className="card-body">
                                        <p className="text-muted mb-1">Activos</p>
                                        <h3 className="fw-bold">
                                            {pedidosActivos.length}
                                        </h3>
                                    </div>
                                </div>
                            </div>

                            <div className="col-12 col-md-4">
                                <div className="card border-0 shadow-sm rounded-4">
                                    <div className="card-body">
                                        <p className="text-muted mb-1">Finalizados</p>
                                        <h3 className="fw-bold">
                                            {pedidosFinalizados.length}
                                        </h3>
                                    </div>
                                </div>
                            </div>

                        </div>

                        <div className="card border-0 shadow-sm rounded-4">
                            <div className="card-body p-4">
                                <div className="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-2 mb-3">
                                    <h4 className="fw-bold mb-0">
                                        Todos los pedidos
                                    </h4>

                                    <button
                                        className="btn btn-outline-success btn-sm"
                                        onClick={cargarDashboard}
                                    >
                                        Actualizar
                                    </button>
                                </div>

                                <TablaPedidos data={pedidos} />
                            </div>
                        </div>
                    </>
                )}


                {vista === "incidencias" && (
                    <div className="card border-0 shadow-sm rounded-4 adomi-admin__section-card">
                        <div className="card-body p-3 p-md-4">
                            <div className="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-2 mb-3">
                                <div>
                                    <h4 className="fw-bold mb-1">Incidencias pendientes</h4>
                                    <p className="text-muted small mb-0">
                                        Pedidos donde el cliente reportó un problema que todavía requiere atención.
                                    </p>
                                </div>
                                <span className={`badge ${incidenciasPendientes.length ? "bg-danger" : "bg-success"}`}>
                                    {incidenciasPendientes.length
                                        ? `${incidenciasPendientes.length} pendiente(s)`
                                        : "Sin pendientes"}
                                </span>
                            </div>

                            {incidenciasPendientes.length > 0 ? (
                                <TablaPedidos data={incidenciasPendientes} />
                            ) : (
                                <div className="adomi-admin__empty">
                                    <i className="bi bi-check-circle"></i>
                                    <strong>Todo al día</strong>
                                    <span>No hay incidencias pendientes por resolver.</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

            </main>

            {pedidoDetalle && (
                <div
                    className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-end align-items-md-center justify-content-center p-0 p-md-3"
                    style={{ background: "rgba(0, 0, 0, 0.55)", zIndex: 2000 }}
                    onClick={cerrarDetallePedido}
                >
                    <div
                        className="card border-0 shadow-lg rounded-top-4 rounded-md-4 w-100"
                        style={{ maxWidth: "760px", maxHeight: "94vh", overflowY: "auto" }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="card-body p-3 p-md-5">
                            <div className="d-flex justify-content-between align-items-start gap-3 mb-4">
                                <div>
                                    <span className="text-muted">Detalle del pedido</span>
                                    <h3 className="fw-bold mb-0">Pedido #{pedidoDetalle.id}</h3>
                                </div>
                                <button
                                    type="button"
                                    className="btn-close"
                                    onClick={cerrarDetallePedido}
                                    disabled={resolviendoIncidencia || guardandoCorreccion}
                                ></button>
                            </div>

                            {pedidoDetalle.estado === "cancelado" && (
                                <div className="border border-danger rounded-4 p-3 p-md-4 mt-3 mb-3">
                                    <div className="d-flex flex-column flex-md-row justify-content-between gap-2 mb-3">
                                        <div>
                                            <h5 className="fw-bold text-danger mb-1">Pedido cancelado</h5>
                                            <p className="text-muted small mb-0">
                                                Puedes corregir los datos antes de reactivarlo.
                                            </p>
                                        </div>

                                        {!editandoPedido && (
                                            <button
                                                type="button"
                                                className="btn btn-outline-dark btn-sm"
                                                onClick={iniciarCorreccion}
                                            >
                                                <i className="bi bi-pencil-square me-1"></i>
                                                Corregir pedido
                                            </button>
                                        )}
                                    </div>

                                    {editandoPedido && (
                                        <div className="bg-light rounded-4 p-3 mb-4">
                                            <h6 className="fw-bold mb-3">Corregir datos</h6>

                                            <div className="mb-3">
                                                <label className="form-label fw-semibold">Lugar de compra</label>
                                                <input
                                                    type="text"
                                                    className="form-control"
                                                    maxLength="150"
                                                    value={datosCorreccion.lugar_compra}
                                                    onChange={(e) => handleCambioCorreccion("lugar_compra", e.target.value)}
                                                    disabled={guardandoCorreccion}
                                                />
                                            </div>

                                            <div className="mb-3">
                                                <label className="form-label fw-semibold">Descripción</label>
                                                <textarea
                                                    className="form-control"
                                                    rows="3"
                                                    value={datosCorreccion.descripcion}
                                                    onChange={(e) => handleCambioCorreccion("descripcion", e.target.value)}
                                                    disabled={guardandoCorreccion}
                                                ></textarea>
                                            </div>

                                            <div className="mb-3">
                                                <label className="form-label fw-semibold">Dirección de entrega</label>
                                                <textarea
                                                    className="form-control"
                                                    rows="2"
                                                    value={datosCorreccion.direccion}
                                                    onChange={(e) => handleCambioCorreccion("direccion", e.target.value)}
                                                    disabled={guardandoCorreccion}
                                                ></textarea>
                                            </div>

                                            <div className="row g-3">
                                                <div className="col-12 col-md-6">
                                                    <label className="form-label fw-semibold">Teléfono</label>
                                                    <input
                                                        type="tel"
                                                        className="form-control"
                                                        inputMode="numeric"
                                                        placeholder="5555-5555"
                                                        value={datosCorreccion.telefono_contacto}
                                                        onChange={(e) => handleTelefonoCorreccion(e.target.value)}
                                                        disabled={guardandoCorreccion}
                                                    />
                                                </div>

                                                <div className="col-12 col-md-6">
                                                    <label className="form-label fw-semibold">Total estimado</label>
                                                    <div className="input-group">
                                                        <span className="input-group-text">Q</span>
                                                        <input
                                                            type="number"
                                                            className="form-control"
                                                            min="0.01"
                                                            step="0.01"
                                                            value={datosCorreccion.total}
                                                            onChange={(e) => handleCambioCorreccion("total", e.target.value)}
                                                            onKeyDown={(e) => {
                                                                if (["-", "e", "E"].includes(e.key)) e.preventDefault();
                                                            }}
                                                            disabled={guardandoCorreccion}
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="d-flex flex-column flex-sm-row justify-content-end gap-2 mt-3">
                                                <button
                                                    type="button"
                                                    className="btn btn-outline-secondary"
                                                    onClick={cancelarCorreccion}
                                                    disabled={guardandoCorreccion}
                                                >
                                                    Cancelar edición
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn btn-dark"
                                                    onClick={handleGuardarCorreccion}
                                                    disabled={guardandoCorreccion}
                                                >
                                                    {guardandoCorreccion ? "Guardando..." : "Guardar cambios"}
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    <div className="border-top pt-3">
                                        <h6 className="fw-bold mb-2">Reactivar pedido</h6>
                                        <p className="text-muted small mb-3">
                                            Después de revisar o corregir los datos, selecciona un repartidor activo.
                                        </p>

                                        <div className="row g-2">
                                            <div className="col-12 col-md-8">
                                                <select
                                                    className="form-select"
                                                    value={repartidorSeleccionado[pedidoDetalle.id] || ""}
                                                    onChange={(e) =>
                                                        setRepartidorSeleccionado({
                                                            ...repartidorSeleccionado,
                                                            [pedidoDetalle.id]: e.target.value
                                                        })
                                                    }
                                                    disabled={editandoPedido || guardandoCorreccion}
                                                >
                                                    <option value="">Seleccionar repartidor</option>
                                                    {repartidores
                                                        .filter((repartidor) => (repartidor.estado || "activo") === "activo")
                                                        .map((repartidor, index) => (
                                                            <option key={repartidor.id} value={repartidor.id}>
                                                                REP-{index + 1} - {repartidor.nombre}
                                                            </option>
                                                        ))}
                                                </select>
                                            </div>
                                            <div className="col-12 col-md-4">
                                                <button
                                                    className="btn btn-success w-100"
                                                    onClick={() => handleReactivarPedido(pedidoDetalle)}
                                                    disabled={
                                                        editandoPedido ||
                                                        guardandoCorreccion ||
                                                        !repartidorSeleccionado[pedidoDetalle.id]
                                                    }
                                                >
                                                    Reactivar pedido
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {pedidoDetalle.confirmacion_cliente === "problema" &&
                                Number(pedidoDetalle.incidencia_resuelta) !== 1 && (
                                    <div className="alert alert-danger rounded-4">
                                        <div className="fw-bold mb-1">
                                            <i className="bi bi-exclamation-triangle-fill me-2"></i>
                                            Cliente reportó un problema
                                        </div>
                                        <div>{pedidoDetalle.comentario_cliente || "Sin comentario adicional"}</div>
                                    </div>
                                )}

                            {Number(pedidoDetalle.incidencia_resuelta) === 1 && (
                                <div className="alert alert-success rounded-4">
                                    <div className="fw-bold mb-2">
                                        <i className="bi bi-check-circle-fill me-2"></i>
                                        Incidencia resuelta
                                    </div>
                                    <div className="mb-2">
                                        {pedidoDetalle.resolucion_admin || "Resolución registrada"}
                                    </div>
                                    <small>
                                        {pedidoDetalle.fecha_resolucion
                                            ? `Resuelta: ${formatearFecha(pedidoDetalle.fecha_resolucion)}`
                                            : "Fecha de resolución no disponible"}
                                    </small>
                                </div>
                            )}

                            <div className="row g-3 mb-4">
                                <div className="col-12 col-md-6">
                                    <div className="bg-light rounded-4 p-3 h-100">
                                        <small className="text-muted d-block">Cliente</small>
                                        <strong>{pedidoDetalle.cliente_nombre || "No disponible"}</strong>
                                    </div>
                                </div>
                                <div className="col-12 col-md-6">
                                    <div className="bg-light rounded-4 p-3 h-100">
                                        <small className="text-muted d-block">Repartidor</small>
                                        <strong>{pedidoDetalle.repartidor_nombre || "Sin asignar"}</strong>
                                    </div>
                                </div>
                                <div className="col-12 col-md-6">
                                    <div className="bg-light rounded-4 p-3 h-100">
                                        <small className="text-muted d-block">Servicio</small>
                                        <strong className="text-capitalize">{pedidoDetalle.tipo_servicio}</strong>
                                    </div>
                                </div>
                                <div className="col-12 col-md-6">
                                    <div className="bg-light rounded-4 p-3 h-100">
                                        <small className="text-muted d-block">Estado</small>
                                        <span className={getEstadoBadge(pedidoDetalle.estado)}>
                                            {pedidoDetalle.estado}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="border rounded-4 p-3 mb-3">
                                <div className="fw-bold mb-1">
                                    <i className="bi bi-shop me-2"></i>Recoger en
                                </div>
                                {pedidoDetalle.lugar_compra || "No registrado"}
                            </div>

                            <div className="border rounded-4 p-3 mb-3">
                                <div className="fw-bold mb-1">
                                    <i className="bi bi-bag me-2"></i>Descripción del pedido
                                </div>
                                {pedidoDetalle.descripcion || "Sin descripción"}
                            </div>

                            <div className="border rounded-4 p-3 mb-3">
                                <div className="fw-bold mb-1">
                                    <i className="bi bi-geo-alt me-2"></i>Dirección de entrega
                                </div>
                                {pedidoDetalle.direccion || "No registrada"}
                            </div>

                            <div className="border rounded-4 p-3 mb-4">
                                <div className="fw-bold mb-1">
                                    <i className="bi bi-telephone me-2"></i>Teléfono de contacto
                                </div>
                                {pedidoDetalle.telefono_contacto ? (
                                    <a href={`tel:${pedidoDetalle.telefono_contacto}`}>
                                        {pedidoDetalle.telefono_contacto}
                                    </a>
                                ) : (
                                    "No registrado"
                                )}
                            </div>

                            <div className="row g-3 mb-4">
                                <div className="col-12 col-md-4">
                                    <div className="text-center bg-light rounded-4 p-3 h-100">
                                        <small className="text-muted d-block">Estimado</small>
                                        <strong>{formatearDinero(pedidoDetalle.total)}</strong>
                                    </div>
                                </div>
                                <div className="col-12 col-md-4">
                                    <div className="text-center bg-light rounded-4 p-3 h-100">
                                        <small className="text-muted d-block">Total real</small>
                                        <strong>{formatearDinero(pedidoDetalle.total_real)}</strong>
                                    </div>
                                </div>
                                <div className="col-12 col-md-4">
                                    <div className="text-center bg-light rounded-4 p-3 h-100">
                                        <small className="text-muted d-block">Diferencia</small>
                                        <strong>{mostrarDiferencia(pedidoDetalle.diferencia)}</strong>
                                    </div>
                                </div>
                            </div>

                            <div className="border-top pt-4">
                                <div className="d-flex flex-wrap justify-content-between gap-2 mb-3">
                                    <div>
                                        <small className="text-muted d-block">Confirmación del cliente</small>
                                        {getConfirmacionClienteBadge(pedidoDetalle.confirmacion_cliente)}
                                    </div>
                                    <div className="text-md-end">
                                        <small className="text-muted d-block">Fecha de entrega</small>
                                        <span>{formatearFecha(pedidoDetalle.fecha_entrega)}</span>
                                    </div>
                                </div>

                                {pedidoDetalle.comentario_cliente && (
                                    <div className="bg-light rounded-4 p-3 mb-3">
                                        <small className="text-muted d-block mb-1">Comentario del cliente</small>
                                        {pedidoDetalle.comentario_cliente}
                                    </div>
                                )}
                            </div>

                            {pedidoDetalle.confirmacion_cliente === "problema" &&
                                Number(pedidoDetalle.incidencia_resuelta) !== 1 && (
                                    <div className="border border-danger rounded-4 p-3 p-md-4 mt-3">
                                        <h5 className="fw-bold text-danger">Resolver incidencia</h5>
                                        <p className="text-muted small">
                                            Escribe qué acción realizó el administrador para atender el problema.
                                        </p>
                                        <textarea
                                            className="form-control mb-2"
                                            rows="4"
                                            maxLength="500"
                                            value={resolucionIncidencia}
                                            onChange={(e) => setResolucionIncidencia(e.target.value)}
                                            placeholder="Ejemplo: Se contactó al cliente y se solucionó el inconveniente..."
                                            disabled={resolviendoIncidencia}
                                        ></textarea>
                                        <div className="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-2">
                                            <small className="text-muted">
                                                {resolucionIncidencia.length}/500
                                            </small>
                                            <button
                                                className="btn btn-danger w-100 w-sm-auto"
                                                onClick={handleResolverIncidencia}
                                                disabled={resolviendoIncidencia || resolucionIncidencia.trim().length < 5}
                                            >
                                                {resolviendoIncidencia
                                                    ? "Guardando..."
                                                    : "Marcar incidencia resuelta"}
                                            </button>
                                        </div>
                                    </div>
                                )}

                            <div className="d-flex justify-content-end mt-4">
                                <button
                                    className="btn btn-outline-secondary"
                                    onClick={cerrarDetallePedido}
                                    disabled={resolviendoIncidencia || guardandoCorreccion}
                                >
                                    Cerrar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}

export default AdminDashboard;