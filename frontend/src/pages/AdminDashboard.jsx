import { useEffect, useRef, useState } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
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
    correctCancelledOrder,
    getReports,
} from "../services/adminService";

import { reactivateCancelledOrder } from "../services/orderService";

import socket from "../socket";
import "./AdminDashboard.css";


function ChartBox({ children, height = 280, className = "" }) {
    const containerRef = useRef(null);
    const [chartWidth, setChartWidth] = useState(0);

    useEffect(() => {
        const element = containerRef.current;
        if (!element) return undefined;

        const updateWidth = () => {
            const nextWidth = Math.floor(element.getBoundingClientRect().width);
            if (nextWidth > 0) {
                setChartWidth(nextWidth);
            }
        };

        updateWidth();

        const observer = new ResizeObserver(updateWidth);
        observer.observe(element);
        window.addEventListener("resize", updateWidth);

        return () => {
            observer.disconnect();
            window.removeEventListener("resize", updateWidth);
        };
    }, []);

    return (
        <div
            ref={containerRef}
            className={`adomi-admin__chart ${className}`.trim()}
            style={{ height }}
        >
            {chartWidth > 0 ? children(chartWidth, height) : null}
        </div>
    );
}

function AdminDashboard() {
    const joinedOrderRoomsRef = useRef(new Set());
    const user = JSON.parse(localStorage.getItem("user"));

    const [vista, setVista] = useState("resumen");
    const [sidebarAbierto, setSidebarAbierto] = useState(false);
    const [modalUsuario, setModalUsuario] = useState(null);
    const [busqueda, setBusqueda] = useState("");
    const [filtroPedido, setFiltroPedido] = useState("todos");
    const [modoPedidos, setModoPedidos] = useState("todos");
    const [repartidorPedidosId, setRepartidorPedidosId] = useState(null);
    const [clientePedidosId, setClientePedidosId] = useState(null);
    const [filtroPromocion, setFiltroPromocion] = useState(0);
    const [stats, setStats] = useState(null);
    const [usuarios, setUsuarios] = useState([]);
    const [pedidos, setPedidos] = useState([]);
    const obtenerFechaLocal = (fecha) => {
    const year = fecha.getFullYear();
    const month = String(fecha.getMonth() + 1).padStart(2, "0");
    const day = String(fecha.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};

const hoy = new Date();

const [fechaInicioReporte, setFechaInicioReporte] = useState(
    `${hoy.getFullYear()}-01-01`
);

const [fechaFinReporte, setFechaFinReporte] = useState(
    obtenerFechaLocal(hoy)
);

const [reporte, setReporte] = useState(null);
const [cargandoReporte, setCargandoReporte] = useState(false);

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

    const calcularMinutosEntregaPedido = (pedido) => {
        if (!pedido?.created_at || !pedido?.fecha_entrega) return null;

        const inicio = new Date(pedido.created_at).getTime();
        const fin = new Date(pedido.fecha_entrega).getTime();

        if (!Number.isFinite(inicio) || !Number.isFinite(fin) || fin < inicio) return null;
        return Math.round((fin - inicio) / 60000);
    };

    const formatearTiempoPedido = (minutos) => {
        if (minutos === null || minutos === undefined || !Number.isFinite(Number(minutos))) {
            return "No disponible";
        }

        const total = Math.max(0, Math.round(Number(minutos)));
        const horas = Math.floor(total / 60);
        const mins = total % 60;

        if (horas === 0) return `${mins} min`;
        if (mins === 0) return `${horas} h`;
        return `${horas} h ${mins} min`;
    };

    const clasificarEficienciaPedido = (pedido) => {
        if (pedido?.estado !== "entregado") return null;

        const minutos = calcularMinutosEntregaPedido(pedido);
        if (minutos === null) {
            return {
                texto: "Sin tiempo",
                clase: "text-bg-secondary",
                icono: "bi-clock-history",
                minutos: null
            };
        }

        if (minutos <= 30) {
            return { texto: "Rápido", clase: "text-bg-success", icono: "bi-lightning-charge-fill", minutos };
        }

        if (minutos <= 60) {
            return { texto: "Normal", clase: "text-bg-primary", icono: "bi-check-circle-fill", minutos };
        }

        if (minutos < 120) {
            return { texto: "Lento", clase: "text-bg-warning", icono: "bi-hourglass-split", minutos };
        }

        return { texto: "Atípico", clase: "text-bg-danger", icono: "bi-exclamation-triangle-fill", minutos };
    };

    const pedidosPendientes = pedidos.filter((p) => p.estado === "pendiente");

    const pedidosAceptados = pedidos.filter(
    (p) => p.estado === "aceptado"
    );

    const pedidosEnCamino = pedidos.filter(
    (p) => p.estado === "en camino"
    );

    const pedidosEntregados = pedidos.filter(
    (p) => p.estado === "entregado"
    );
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

    const pedidosFiltrados = (() => {
        if (filtroPedido === "pendiente") return pedidosPendientes;
        if (filtroPedido === "aceptado") return pedidosAceptados;
        if (filtroPedido === "en camino") return pedidosEnCamino;
        if (filtroPedido === "entregado") return pedidosEntregados;
        if (filtroPedido === "cancelado") return pedidosCancelados;
        if (filtroPedido === "incidencias") return incidenciasPendientes;
        return pedidos;
    })();

    const abrirPedidosFiltrados = (filtro) => {
        setFiltroPedido(filtro);
        setVista("pedidos");
        setBusqueda("");
    };

    const obtenerMontoPedido = (pedido) => {
        const valor = pedido?.total_real ?? pedido?.total ?? 0;
        const numero = Number(valor);
        return Number.isFinite(numero) ? numero : 0;
    };

    const resumenRepartidoresPedidos = repartidores
        .map((repartidor) => {
            const propios = pedidos.filter((pedido) =>
                Number(pedido.repartidor_id) === Number(repartidor.id) ||
                (!pedido.repartidor_id && pedido.repartidor_nombre === repartidor.nombre)
            );
            const entregadosRep = propios.filter((pedido) => pedido.estado === "entregado");
            const activosRep = propios.filter((pedido) =>
                pedido.estado === "aceptado" || pedido.estado === "en camino"
            );
            const canceladosRep = propios.filter((pedido) => pedido.estado === "cancelado");
            const canceladosPorRepartidor = canceladosRep.filter(
                (pedido) => pedido.cancelado_por === "repartidor"
            ).length;
            const canceladosPorCliente = canceladosRep.filter(
                (pedido) => pedido.cancelado_por === "cliente"
            ).length;
            const canceladosNoRegistrados = canceladosRep.filter(
                (pedido) => !pedido.cancelado_por
            ).length;
            const eficiencia = entregadosRep.reduce(
                (acc, pedido) => {
                    const dato = clasificarEficienciaPedido(pedido);
                    if (dato?.texto === "Rápido") acc.rapidos += 1;
                    if (dato?.texto === "Normal") acc.normales += 1;
                    if (dato?.texto === "Lento") acc.lentos += 1;
                    if (dato?.texto === "Atípico") acc.atipicos += 1;
                    return acc;
                },
                { rapidos: 0, normales: 0, lentos: 0, atipicos: 0 }
            );

            return {
                ...repartidor,
                pedidos: propios,
                asignados: propios.length,
                entregados: entregadosRep.length,
                activos: activosRep.length,
                cancelados: canceladosRep.length,
                canceladosPorRepartidor,
                canceladosPorCliente,
                canceladosNoRegistrados,
                ...eficiencia
            };
        })
        .sort((a, b) => b.entregados - a.entregados || b.asignados - a.asignados);

    const resumenClientesPedidos = clientes
        .map((cliente) => {
            const propios = pedidos.filter((pedido) =>
                Number(pedido.cliente_id) === Number(cliente.id) ||
                (!pedido.cliente_id && pedido.cliente_nombre === cliente.nombre)
            );
            const entregadosCli = propios.filter((pedido) => pedido.estado === "entregado");
            const canceladosCli = propios.filter((pedido) => pedido.estado === "cancelado");
            const totalComprado = entregadosCli.reduce(
                (suma, pedido) => suma + obtenerMontoPedido(pedido),
                0
            );

            return {
                ...cliente,
                pedidos: propios,
                realizados: propios.length,
                entregados: entregadosCli.length,
                cancelados: canceladosCli.length,
                totalComprado
            };
        })
        .sort((a, b) =>
            b.entregados - a.entregados ||
            b.totalComprado - a.totalComprado ||
            b.realizados - a.realizados
        );

    const clientesPromocion = resumenClientesPedidos.filter(
        (item) => item.entregados >= filtroPromocion
    );

    const repartidorPedidosSeleccionado = resumenRepartidoresPedidos.find(
        (item) => Number(item.id) === Number(repartidorPedidosId)
    );

    const clientePedidosSeleccionado = resumenClientesPedidos.find(
        (item) => Number(item.id) === Number(clientePedidosId)
    );

    const cambiarModoPedidos = (modo) => {
        setModoPedidos(modo);
        setBusqueda("");
        setFiltroPedido("todos");
        setRepartidorPedidosId(null);
        setClientePedidosId(null);
        setFiltroPromocion(0);
    };

    const pedidosChartData = [
        { name: "Pendientes", cantidad: pedidosPendientes.length, color: "#6c757d" },
        { name: "Aceptados", cantidad: pedidosAceptados.length, color: "#0d6efd" },
        { name: "En camino", cantidad: pedidosEnCamino.length, color: "#ffc107" },
        { name: "Entregados", cantidad: pedidosEntregados.length, color: "#198754" },
        { name: "Cancelados", cantidad: pedidosCancelados.length, color: "#dc3545" }
    ];

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

    const handleGenerarReporte = async () => {
    if (!fechaInicioReporte || !fechaFinReporte) {
        setError("Selecciona la fecha inicial y la fecha final");
        return;
    }

    if (fechaInicioReporte > fechaFinReporte) {
        setError("La fecha inicial no puede ser mayor que la fecha final");
        return;
    }

    try {
        setCargandoReporte(true);
        setError("");

        const data = await getReports(
            fechaInicioReporte,
            fechaFinReporte
        );

        setReporte(data);
    } catch (error) {
        console.error(error);

        setError(
            error.response?.data?.message ||
            "No se pudo generar el reporte"
        );
    } finally {
        setCargandoReporte(false);
    }
};

    const exportarReportePDF = () => {
        if (!reporte) {
            setError("Primero genera un reporte antes de exportarlo");
            return;
        }

        try {
            setError("");

            const resumen = reporte.resumen || {};
            const pedidosReporte = (reporte.pedidos || []).map((pedido) => {
                const pedidoCompleto = pedidos.find(
                    (item) => Number(item.id) === Number(pedido.id)
                );

                return {
                    ...pedido,
                    cancelado_por: pedido.cancelado_por ?? pedidoCompleto?.cancelado_por ?? null,
                    confirmacion_cliente: pedido.confirmacion_cliente ?? pedidoCompleto?.confirmacion_cliente ?? null,
                    comentario_cliente: pedido.comentario_cliente ?? pedidoCompleto?.comentario_cliente ?? null,
                    fecha_confirmacion_cliente: pedido.fecha_confirmacion_cliente ?? pedidoCompleto?.fecha_confirmacion_cliente ?? null,
                    incidencia_resuelta: pedido.incidencia_resuelta ?? pedidoCompleto?.incidencia_resuelta ?? 0,
                    resolucion_admin: pedido.resolucion_admin ?? pedidoCompleto?.resolucion_admin ?? null,
                    fecha_resolucion: pedido.fecha_resolucion ?? pedidoCompleto?.fecha_resolucion ?? null,
                    fecha_entrega: pedido.fecha_entrega ?? pedidoCompleto?.fecha_entrega ?? null
                };
            });
            const repartidoresReporte = reporte.repartidores || [];
            const serviciosReporte = reporte.por_servicio || [];
            const estadosBase = ["pendiente", "aceptado", "en camino", "entregado", "cancelado"];

            const totalPedidos = Number(resumen.total_pedidos || pedidosReporte.length || 0);
            const obtenerTotalEstado = (estado) => Number(
                (reporte.por_estado || []).find((item) => item.estado === estado)?.total || 0
            );

            const pendientes = obtenerTotalEstado("pendiente");
            const aceptados = obtenerTotalEstado("aceptado");
            const enCamino = obtenerTotalEstado("en camino");
            const entregados = obtenerTotalEstado("entregado");
            const cancelados = obtenerTotalEstado("cancelado");
            const incidencias = Number(resumen.incidencias_pendientes || 0);
            const montoEntregado = Number(resumen.total_entregado || 0);
            const tasaEntrega = totalPedidos > 0 ? (entregados / totalPedidos) * 100 : 0;
            const tasaCancelacion = totalPedidos > 0 ? (cancelados / totalPedidos) * 100 : 0;
            const promedioEntregado = entregados > 0 ? montoEntregado / entregados : 0;
            const activos = pendientes + aceptados + enCamino;

            const calcularMinutosPedido = (pedido) => {
                if (!pedido?.created_at || !pedido?.fecha_entrega) return null;

                const inicio = new Date(pedido.created_at).getTime();
                const fin = new Date(pedido.fecha_entrega).getTime();

                if (!Number.isFinite(inicio) || !Number.isFinite(fin) || fin < inicio) return null;

                return Math.round((fin - inicio) / 60000);
            };

            const formatearDuracion = (minutos) => {
                if (minutos === null || minutos === undefined || !Number.isFinite(Number(minutos))) {
                    return "No disponible";
                }

                const total = Math.max(0, Math.round(Number(minutos)));
                const horas = Math.floor(total / 60);
                const mins = total % 60;

                if (horas === 0) return `${mins} min`;
                if (mins === 0) return `${horas} h`;
                return `${horas} h ${mins} min`;
            };

            const pedidosEntregadosConTiempo = pedidosReporte
                .filter((pedido) => pedido.estado === "entregado")
                .map((pedido) => ({
                    ...pedido,
                    minutosEntrega: calcularMinutosPedido(pedido)
                }))
                .filter((pedido) => pedido.minutosEntrega !== null);

            const tiemposEntrega = pedidosEntregadosConTiempo.map((pedido) => pedido.minutosEntrega);
            const tiempoPromedioEntrega = tiemposEntrega.length > 0
                ? tiemposEntrega.reduce((acumulado, minutos) => acumulado + minutos, 0) / tiemposEntrega.length
                : null;
            const entregaMasRapida = tiemposEntrega.length > 0 ? Math.min(...tiemposEntrega) : null;
            const entregaMasLenta = tiemposEntrega.length > 0 ? Math.max(...tiemposEntrega) : null;

            const tiemposPorRepartidor = pedidosEntregadosConTiempo.reduce((acumulado, pedido) => {
                const nombre = pedido.repartidor || pedido.repartidor_nombre || "Sin asignar";
                if (nombre === "Sin asignar") return acumulado;

                if (!acumulado[nombre]) acumulado[nombre] = [];
                acumulado[nombre].push(pedido.minutosEntrega);
                return acumulado;
            }, {});

            const rendimientoTiempoRepartidores = Object.entries(tiemposPorRepartidor)
                .map(([nombre, tiempos]) => ({
                    nombre,
                    pedidosMedidos: tiempos.length,
                    promedio: tiempos.reduce((suma, minutos) => suma + minutos, 0) / tiempos.length,
                    masRapido: Math.min(...tiempos),
                    masLento: Math.max(...tiempos)
                }))
                .sort((a, b) => a.promedio - b.promedio);

            const repartidorMenorTiempo = rendimientoTiempoRepartidores[0] || null;
            const repartidorMayorTiempo = rendimientoTiempoRepartidores.length > 0
                ? rendimientoTiempoRepartidores[rendimientoTiempoRepartidores.length - 1]
                : null;

            const nombreAdministrador = user?.nombre || "Administrador ADOMI";
            const fechaGeneracion = new Date().toLocaleString("es-GT", {
                dateStyle: "medium",
                timeStyle: "short"
            });

            const moneda = (valor) => `Q ${Number(valor || 0).toLocaleString("es-GT", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            })}`;
            const porcentaje = (valor) => `${Number(valor || 0).toFixed(1)}%`;
            const textoEstado = (estado) => estado === "en camino"
                ? "En camino"
                : String(estado || "").charAt(0).toUpperCase() + String(estado || "").slice(1);

            const doc = new jsPDF({
                orientation: "portrait",
                unit: "mm",
                format: "a4"
            });

            const W = doc.internal.pageSize.getWidth();
            const H = doc.internal.pageSize.getHeight();
            const M = 14;
            const navy = [15, 23, 42];
            const blue = [37, 99, 235];
            const green = [22, 163, 74];
            const amber = [217, 119, 6];
            const red = [220, 38, 38];
            const slate = [71, 85, 105];
            const light = [248, 250, 252];
            const border = [226, 232, 240];

            const encabezado = (subtitulo = "Informe administrativo de pedidos") => {
                doc.setFillColor(...navy);
                doc.rect(0, 0, W, 25, "F");
                doc.setTextColor(255, 255, 255);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(17);
                doc.text("ADOMI", M, 10);
                doc.setFontSize(9);
                doc.setFont("helvetica", "normal");
                doc.text(subtitulo, M, 17);
                doc.setFontSize(8);
                doc.text(`${fechaInicioReporte} al ${fechaFinReporte}`, W - M, 10, { align: "right" });
                doc.text(`Generado: ${fechaGeneracion}`, W - M, 17, { align: "right" });
            };

            const pie = () => {
                const paginas = doc.getNumberOfPages();
                for (let i = 1; i <= paginas; i += 1) {
                    doc.setPage(i);
                    const pageW = doc.internal.pageSize.getWidth();
                    const pageH = doc.internal.pageSize.getHeight();
                    doc.setDrawColor(...border);
                    doc.line(M, pageH - 12, pageW - M, pageH - 12);
                    doc.setFont("helvetica", "normal");
                    doc.setFontSize(7.5);
                    doc.setTextColor(...slate);
                    doc.text("Documento generado automáticamente por el sistema ADOMI", M, pageH - 7);
                    doc.text(`Página ${i} de ${paginas}`, pageW - M, pageH - 7, { align: "right" });
                }
            };

            const tituloSeccion = (titulo, y) => {
                doc.setTextColor(...navy);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(11);
                doc.text(titulo, M, y);
                doc.setDrawColor(...blue);
                doc.setLineWidth(0.8);
                doc.line(M, y + 2, M + 24, y + 2);
            };

            const tarjeta = (x, y, w, titulo, valor, color) => {
                doc.setFillColor(255, 255, 255);
                doc.setDrawColor(...border);
                doc.roundedRect(x, y, w, 25, 2, 2, "FD");
                doc.setFillColor(...color);
                doc.rect(x, y, 2.5, 25, "F");
                doc.setFont("helvetica", "bold");
                doc.setFontSize(7.5);
                doc.setTextColor(...slate);
                doc.text(titulo.toUpperCase(), x + 6, y + 8);
                doc.setFontSize(14);
                doc.setTextColor(...navy);
                doc.text(String(valor), x + 6, y + 18);
            };

            encabezado();
            doc.setTextColor(...navy);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(18);
            doc.text("Resumen ejecutivo", M, 37);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8.5);
            doc.setTextColor(...slate);
            doc.text(`Administrador: ${nombreAdministrador}`, M, 43);

            const gap = 4;
            const cardW = (W - (M * 2) - (gap * 2)) / 3;
            tarjeta(M, 50, cardW, "Total pedidos", totalPedidos, blue);
            tarjeta(M + cardW + gap, 50, cardW, "Entregados", entregados, green);
            tarjeta(M + (cardW + gap) * 2, 50, cardW, "Tasa de entrega", porcentaje(tasaEntrega), green);
            tarjeta(M, 79, cardW, "En camino", enCamino, amber);
            tarjeta(M + cardW + gap, 79, cardW, "Cancelados", cancelados, red);
            tarjeta(M + (cardW + gap) * 2, 79, cardW, "Monto entregado", moneda(montoEntregado), blue);

            tituloSeccion("Lectura rápida", 116);
            doc.setFillColor(...light);
            doc.setDrawColor(...border);
            doc.roundedRect(M, 121, W - M * 2, 30, 2, 2, "FD");
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.setTextColor(...slate);
            const resumenTexto = `Durante el período analizado se registraron ${totalPedidos} pedidos. ${entregados} fueron entregados (${porcentaje(tasaEntrega)}), ${cancelados} fueron cancelados (${porcentaje(tasaCancelacion)}) y ${activos} permanecen activos al cierre del período. El monto acumulado de pedidos entregados es ${moneda(montoEntregado)}, con un promedio de ${moneda(promedioEntregado)} por pedido entregado.${tiempoPromedioEntrega !== null ? ` El tiempo promedio desde que el cliente realizó el pedido hasta su entrega fue de ${formatearDuracion(tiempoPromedioEntrega)}.` : ""} Se reportan ${incidencias} incidencias pendientes.`;
            doc.text(doc.splitTextToSize(resumenTexto, W - M * 2 - 10), M + 5, 129, { lineHeightFactor: 1.45 });

            tituloSeccion("Pedidos por estado", 163);
            autoTable(doc, {
                startY: 168,
                margin: { left: M, right: M, bottom: 18 },
                head: [["Estado", "Cantidad", "% del total"]],
                body: estadosBase.map((estado) => {
                    const cantidad = obtenerTotalEstado(estado);
                    return [textoEstado(estado), cantidad, porcentaje(totalPedidos > 0 ? (cantidad / totalPedidos) * 100 : 0)];
                }).concat([["TOTAL", totalPedidos, "100.0%"]]),
                theme: "grid",
                headStyles: { fillColor: blue, textColor: 255, fontStyle: "bold", halign: "center" },
                bodyStyles: { fontSize: 8.5, textColor: navy },
                alternateRowStyles: { fillColor: light },
                columnStyles: { 1: { halign: "center" }, 2: { halign: "center" } },
                styles: { lineColor: border, lineWidth: 0.2, cellPadding: 2.4 }
            });

            const yServicios = doc.lastAutoTable.finalY + 9;
            tituloSeccion("Distribución por servicio", yServicios);
            autoTable(doc, {
                startY: yServicios + 5,
                margin: { left: M, right: M, bottom: 18 },
                head: [["Tipo de servicio", "Pedidos", "% del total"]],
                body: serviciosReporte.map((item) => {
                    const cantidad = Number(item.total || 0);
                    return [textoEstado(item.tipo_servicio || "Sin especificar"), cantidad, porcentaje(totalPedidos > 0 ? (cantidad / totalPedidos) * 100 : 0)];
                }).concat([["TOTAL", totalPedidos, "100.0%"]]),
                theme: "grid",
                headStyles: { fillColor: navy, textColor: 255, fontStyle: "bold", halign: "center" },
                bodyStyles: { fontSize: 8.5, textColor: navy },
                alternateRowStyles: { fillColor: light },
                columnStyles: { 1: { halign: "center" }, 2: { halign: "center" } },
                styles: { lineColor: border, lineWidth: 0.2, cellPadding: 2.4 }
            });

            doc.addPage();
            encabezado("Rendimiento y control operativo");
            tituloSeccion("Rendimiento de repartidores", 37);
            autoTable(doc, {
                startY: 42,
                margin: { left: M, right: M, bottom: 18 },
                head: [["Repartidor", "Asignados", "Entregados", "Cancelados", "% entrega", "Tiempo prom.", "Más rápido", "Más tardado", "Monto"]],
                body: repartidoresReporte.map((item) => {
                    const asignados = Number(item.pedidos_asignados || 0);
                    const entregadosRep = Number(item.entregados || 0);
                    const tiempoRep = rendimientoTiempoRepartidores.find(
                        (dato) => dato.nombre === (item.nombre || "Sin nombre")
                    );
                    return [
                        item.nombre || "Sin nombre",
                        asignados,
                        entregadosRep,
                        Number(item.cancelados || 0),
                        porcentaje(asignados > 0 ? (entregadosRep / asignados) * 100 : 0),
                        tiempoRep ? formatearDuracion(tiempoRep.promedio) : "No disponible",
                        tiempoRep ? formatearDuracion(tiempoRep.masRapido) : "-",
                        tiempoRep ? formatearDuracion(tiempoRep.masLento) : "-",
                        moneda(Number(item.total_entregado || 0))
                    ];
                }),
                theme: "grid",
                headStyles: { fillColor: blue, textColor: 255, fontStyle: "bold", halign: "center" },
                bodyStyles: { fontSize: 7.2, textColor: navy },
                alternateRowStyles: { fillColor: light },
                columnStyles: {
                    1: { halign: "center" }, 2: { halign: "center" }, 3: { halign: "center" },
                    4: { halign: "center" }, 5: { halign: "center" }, 6: { halign: "center" },
                    7: { halign: "center" }, 8: { halign: "right" }
                },
                styles: { lineColor: border, lineWidth: 0.2, cellPadding: 2.2 }
            });

            const yGestion = doc.lastAutoTable.finalY + 10;
            tituloSeccion("Indicadores de gestión", yGestion);
            autoTable(doc, {
                startY: yGestion + 5,
                margin: { left: M, right: M, bottom: 18 },
                body: [
                    ["Pedidos activos", activos, "Pedidos aún pendientes, aceptados o en camino"],
                    ["Tasa de entrega", porcentaje(tasaEntrega), "Entregados respecto al total del período"],
                    ["Tasa de cancelación", porcentaje(tasaCancelacion), "Cancelados respecto al total del período"],
                    ["Promedio por pedido entregado", moneda(promedioEntregado), "Monto entregado dividido entre pedidos entregados"],
                    ["Tiempo promedio del pedido", formatearDuracion(tiempoPromedioEntrega), "Desde que el cliente realiza el pedido hasta que se registra como entregado"],
                    ["Entrega más rápida", formatearDuracion(entregaMasRapida), "Menor tiempo total entre los pedidos entregados del período"],
                    ["Entrega más tardada", formatearDuracion(entregaMasLenta), "Mayor tiempo total entre los pedidos entregados del período"],
                    ["Pedidos con tiempo medible", tiemposEntrega.length, "Pedidos entregados con fecha de creación y fecha de entrega válidas"],
                    ["Menor tiempo promedio", repartidorMenorTiempo ? `${repartidorMenorTiempo.nombre} · ${formatearDuracion(repartidorMenorTiempo.promedio)}` : "No disponible", "Repartidor con menor tiempo promedio entre sus pedidos entregados medibles"],
                    ["Mayor tiempo promedio", repartidorMayorTiempo ? `${repartidorMayorTiempo.nombre} · ${formatearDuracion(repartidorMayorTiempo.promedio)}` : "No disponible", "Repartidor con mayor tiempo promedio entre sus pedidos entregados medibles"],
                    ["Incidencias pendientes", incidencias, "Casos reportados por clientes aún sin resolver"]
                ],
                theme: "grid",
                bodyStyles: { fontSize: 8.5, textColor: navy },
                alternateRowStyles: { fillColor: light },
                columnStyles: { 0: { fontStyle: "bold", cellWidth: 52 }, 1: { halign: "center", cellWidth: 35 } },
                styles: { lineColor: border, lineWidth: 0.2, cellPadding: 2.5 }
            });

            const pedidosConIncidencia = pedidosReporte.filter((pedido) => pedido.confirmacion_cliente === "problema");
            const incidenciasResueltas = pedidosConIncidencia.filter(
                (pedido) => Number(pedido.incidencia_resuelta) === 1
            ).length;
            const incidenciasSinResolver = pedidosConIncidencia.length - incidenciasResueltas;

            doc.addPage();
            encabezado("Control y seguimiento de incidencias");

            doc.setTextColor(...navy);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(18);
            doc.text("Incidencias del período", M, 37);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8.5);
            doc.setTextColor(...slate);
            doc.text("Seguimiento de problemas reportados por los clientes y su resolución administrativa.", M, 43);

            const cardIncW = (W - (M * 2) - (gap * 2)) / 3;
            tarjeta(M, 51, cardIncW, "Reportadas", pedidosConIncidencia.length, red);
            tarjeta(M + cardIncW + gap, 51, cardIncW, "Resueltas", incidenciasResueltas, green);
            tarjeta(M + (cardIncW + gap) * 2, 51, cardIncW, "Pendientes", incidenciasSinResolver, amber);

            tituloSeccion("Detalle de incidencias", 88);

            if (pedidosConIncidencia.length === 0) {
                doc.setFillColor(240, 253, 244);
                doc.setDrawColor(187, 247, 208);
                doc.roundedRect(M, 94, W - M * 2, 22, 2, 2, "FD");
                doc.setTextColor(...green);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(9);
                doc.text("No se registran pedidos con incidencia en el período seleccionado.", M + 5, 107);
            } else {
                autoTable(doc, {
                    startY: 94,
                    margin: { left: M, right: M, bottom: 18 },
                    head: [["Pedido", "Cliente", "Estado", "Situación", "Resolución"]],
                    body: pedidosConIncidencia.map((pedido) => [
                        `#${pedido.id}`,
                        pedido.cliente || pedido.cliente_nombre || "No disponible",
                        Number(pedido.incidencia_resuelta) === 1 ? "Resuelto" : "Pendiente",
                        pedido.comentario_cliente || "Sin comentario",
                        pedido.resolucion_admin || "Pendiente de resolución"
                    ]),
                    theme: "grid",
                    headStyles: { fillColor: navy, textColor: 255, fontStyle: "bold" },
                    bodyStyles: { fontSize: 7.8, textColor: navy, valign: "middle" },
                    alternateRowStyles: { fillColor: light },
                    columnStyles: {
                        0: { halign: "center", cellWidth: 17 },
                        2: { halign: "center", cellWidth: 24 },
                        3: { cellWidth: 55 },
                        4: { cellWidth: 60 }
                    },
                    styles: { lineColor: border, lineWidth: 0.2, cellPadding: 2.3 }
                });
            }

            doc.addPage("a4", "landscape");
            const WL = doc.internal.pageSize.getWidth();
            doc.setFillColor(...navy);
            doc.rect(0, 0, WL, 25, "F");
            doc.setTextColor(255, 255, 255);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(16);
            doc.text("ADOMI · DETALLE DE PEDIDOS", M, 11);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            doc.text(`${fechaInicioReporte} al ${fechaFinReporte}`, WL - M, 11, { align: "right" });
            doc.text("Trazabilidad de los pedidos incluidos en el informe", M, 18);

            autoTable(doc, {
                startY: 31,
                margin: { left: 8, right: 8, bottom: 16 },
                head: [["#", "Fecha", "Cliente", "Repartidor", "Servicio", "Estado", "Cancelado por", "Tiempo total", "Estimado", "Real", "Confirmación"]],
                body: pedidosReporte.map((pedido) => {
                    const pedidoCompleto = pedidos.find((item) => Number(item.id) === Number(pedido.id));
                    const canceladoPor = pedido.cancelado_por ?? pedidoCompleto?.cancelado_por ?? null;
                    const canceladoPorTexto = pedido.estado === "cancelado"
                        ? canceladoPor === "cliente"
                            ? "Cliente"
                            : canceladoPor === "repartidor"
                                ? "Repartidor"
                                : canceladoPor === "admin"
                                    ? "Administrador"
                                    : "No registrado"
                        : "-";

                    return [
                    pedido.id ?? "",
                    pedido.created_at ? new Date(pedido.created_at).toLocaleDateString("es-GT") : "",
                    pedido.cliente || pedido.cliente_nombre || "No disponible",
                    pedido.repartidor || pedido.repartidor_nombre || "Sin asignar",
                    pedido.tipo_servicio || "",
                    textoEstado(pedido.estado),
                    canceladoPorTexto,
                    pedido.estado === "entregado" ? formatearDuracion(calcularMinutosPedido(pedido)) : "-",
                    moneda(pedido.total),
                    pedido.total_real !== null && pedido.total_real !== undefined ? moneda(pedido.total_real) : "Pendiente",
                    pedido.estado !== "entregado"
                        ? "No aplica"
                        : pedido.confirmacion_cliente === "problema" && Number(pedido.incidencia_resuelta) === 1
                            ? "Resuelto"
                            : pedido.confirmacion_cliente === "confirmado"
                                ? "Confirmado"
                                : pedido.confirmacion_cliente === "problema"
                                    ? "Problema reportado"
                                    : "Sin confirmar"
                    ];
                }),
                theme: "grid",
                headStyles: { fillColor: blue, textColor: 255, fontStyle: "bold", halign: "center", fontSize: 7 },
                bodyStyles: { fontSize: 6.7, textColor: navy, valign: "middle" },
                alternateRowStyles: { fillColor: light },
                columnStyles: {
                    0: { halign: "center", cellWidth: 10 },
                    1: { cellWidth: 21 },
                    2: { cellWidth: 35 },
                    3: { cellWidth: 35 },
                    4: { cellWidth: 23 },
                    5: { cellWidth: 20 },
                    6: { cellWidth: 23 },
                    7: { halign: "center", cellWidth: 23 },
                    8: { halign: "right", cellWidth: 21 },
                    9: { halign: "right", cellWidth: 21 },
                    10: { cellWidth: 27 }
                },
                styles: { lineColor: border, lineWidth: 0.15, cellPadding: 1.7 }
            });

            pie();

            const nombreArchivo = `ADOMI_Informe_Pedidos_${fechaInicioReporte}_${fechaFinReporte}.pdf`;
            doc.save(nombreArchivo);
            setMensaje("Informe PDF generado correctamente");
            setTimeout(() => setMensaje(""), 3000);
        } catch (error) {
            console.error("Error al generar PDF:", error);
            setError("No se pudo generar el informe PDF");
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
        return new Date(fecha).toLocaleString("es-GT");
    };

    const calcularTiempoTotalPedido = (pedido) => {
        if (!pedido?.created_at || !pedido?.fecha_entrega || pedido?.estado !== "entregado") return null;

        const inicio = new Date(pedido.created_at).getTime();
        const fin = new Date(pedido.fecha_entrega).getTime();
        if (!Number.isFinite(inicio) || !Number.isFinite(fin) || fin < inicio) return null;

        return Math.round((fin - inicio) / 60000);
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

    const getCanceladoPor = (pedido) => {
        if (pedido?.estado !== "cancelado") return null;

        const pedidoCompleto = pedidos.find(
            (item) => Number(item.id) === Number(pedido.id)
        );
        const canceladoPor = pedido.cancelado_por ?? pedidoCompleto?.cancelado_por ?? null;

        if (canceladoPor === "cliente") {
            return { texto: "Cliente", icono: "bi-person", clase: "text-danger" };
        }

        if (canceladoPor === "repartidor") {
            return { texto: "Repartidor", icono: "bi-bicycle", clase: "text-warning" };
        }

        if (canceladoPor === "admin") {
            return { texto: "Administrador", icono: "bi-shield-check", clase: "text-primary" };
        }

        return { texto: "No registrado", icono: "bi-question-circle", clase: "text-muted" };
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
                                        {pedido.estado === "cancelado" && (
                                            <small className={`d-block mt-1 ${getCanceladoPor(pedido).clase}`}>
                                                <i className={`bi ${getCanceladoPor(pedido).icono} me-1`}></i>
                                                Cancelado por: <strong>{getCanceladoPor(pedido).texto}</strong>
                                            </small>
                                        )}
                                        {tieneProblema && !incidenciaResuelta && (
                                            <span className="badge bg-danger ms-2">Problema</span>
                                        )}
                                        {tieneProblema && incidenciaResuelta && (
                                            <span className="badge bg-success ms-2">Resuelto</span>
                                        )}
                                    </td>
                                    <td>
                                        {pedido.estado === "entregado" && (() => {
                                            const eficiencia = clasificarEficienciaPedido(pedido);
                                            return (
                                                <div className="d-flex align-items-center gap-2 flex-wrap mb-2">
                                                    <span className={`badge rounded-pill ${eficiencia.clase}`}>
                                                        <i className={`bi ${eficiencia.icono} me-1`}></i>
                                                        {eficiencia.texto}
                                                    </span>
                                                    <span className="small text-muted fw-semibold">
                                                        <i className="bi bi-stopwatch me-1"></i>
                                                        {formatearTiempoPedido(eficiencia.minutos)}
                                                    </span>
                                                </div>
                                            );
                                        })()}

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
                                <div className="text-end">
                                    <span className={getEstadoBadge(pedido.estado)}>
                                        {pedido.estado}
                                    </span>
                                    {pedido.estado === "cancelado" && (
                                        <small className={`d-block mt-2 ${getCanceladoPor(pedido).clase}`}>
                                            <i className={`bi ${getCanceladoPor(pedido).icono} me-1`}></i>
                                            Cancelado por: <strong>{getCanceladoPor(pedido).texto}</strong>
                                        </small>
                                    )}
                                </div>
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
                                        {pedido.estado === "entregado" && (() => {
                                            const eficiencia = clasificarEficienciaPedido(pedido);
                                            return (
                                                <div className="d-flex align-items-center gap-2 flex-wrap mb-2">
                                                    <span className={`badge rounded-pill ${eficiencia.clase}`}>
                                                        <i className={`bi ${eficiencia.icono} me-1`}></i>
                                                        {eficiencia.texto}
                                                    </span>
                                                    <span className="small text-muted fw-semibold">
                                                        <i className="bi bi-stopwatch me-1"></i>
                                                        {formatearTiempoPedido(eficiencia.minutos)}
                                                    </span>
                                                </div>
                                            );
                                        })()}


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
        <div className="adomi-admin">
            {sidebarAbierto && <button className="adomi-admin__scrim d-lg-none" aria-label="Cerrar menú" onClick={() => setSidebarAbierto(false)}></button>}

            <aside className={`adomi-admin__sidebar ${sidebarAbierto ? "is-open" : ""}`}>
                <div className="adomi-admin__brand"><div className="adomi-admin__brand-mark"><i className="bi bi-box-seam"></i></div><div><strong>ADOMI</strong><span>Administración</span></div><button className="btn-close btn-close-white d-lg-none ms-auto" onClick={() => setSidebarAbierto(false)}></button></div>
                <div className="adomi-admin__profile"><div className="adomi-admin__avatar">{user?.nombre?.charAt(0)?.toUpperCase() || "A"}</div><div><strong>{user?.nombre || "Administrador"}</strong><span>Administrador</span></div></div>
                <nav className="adomi-admin__menu">
                    {[
                        ["resumen", "bi-grid-1x2", "Resumen"],
                        ["clientes", "bi-people", "Clientes"],
                        ["repartidores", "bi-bicycle", "Repartidores"],
                        ["administradores", "bi-shield-lock", "Administradores"],
                        ["pedidos", "bi-bag-check", "Pedidos"],
                        ["incidencias", "bi-exclamation-triangle", "Incidencias"],
                        ["reportes", "bi-bar-chart-line", "Reportes"],
                    ].map(([key, icon, label]) => (
                        <button key={key} className={vista === key ? "active" : ""} onClick={() => { setVista(key); if (key === "pedidos") setFiltroPedido("todos"); setBusqueda(""); setSidebarAbierto(false); }}>
                            <i className={`bi ${icon}`}></i><span>{label}</span>
                            {key === "incidencias" && incidenciasPendientes.length > 0 && <b>{incidenciasPendientes.length}</b>}
                        </button>
                    ))}
                </nav>
                <div className="adomi-admin__sidebar-foot"><button onClick={cerrarSesion}><i className="bi bi-box-arrow-left"></i><span>Cerrar sesión</span></button></div>
            </aside>

            <div className="adomi-admin__workspace">
                <header className="adomi-admin__topbar">
                    <button className="adomi-admin__menu-toggle d-lg-none" onClick={() => setSidebarAbierto(true)}><i className="bi bi-list"></i></button>
                    <div><span className="adomi-admin__top-label">Panel administrativo</span><strong>{vista.charAt(0).toUpperCase() + vista.slice(1)}</strong></div>
                    <div className="adomi-admin__top-actions">
                        <button className="adomi-admin__icon-btn" onClick={cargarDashboard} title="Actualizar"><i className="bi bi-arrow-clockwise"></i></button>
                        <button className="adomi-admin__icon-btn adomi-admin__notification" onClick={() => setVista("incidencias")} title="Incidencias"><i className="bi bi-bell"></i>{incidenciasPendientes.length > 0 && <span>{incidenciasPendientes.length}</span>}</button>
                        <div className="adomi-admin__top-user d-none d-sm-flex"><div className="adomi-admin__avatar small">{user?.nombre?.charAt(0)?.toUpperCase() || "A"}</div><div><strong>{user?.nombre || "Administrador"}</strong><span>En línea</span></div></div>
                    </div>
                </header>

                <main className="adomi-admin__content">
                    {mensaje && <div className="alert alert-success adomi-admin__toast"><i className="bi bi-check-circle-fill me-2"></i>{mensaje}</div>}
                    {error && <div className="alert alert-danger adomi-admin__toast"><i className="bi bi-exclamation-circle-fill me-2"></i>{error}</div>}

                    <div className="adomi-admin__welcome">
                        <div><span className="adomi-admin__eyebrow">Centro de control</span><h1>{vista === "resumen" ? `Bienvenido, ${user?.nombre?.split(" ")[0] || "Administrador"}` : vista.charAt(0).toUpperCase() + vista.slice(1)}</h1><p>{vista === "resumen" ? "Supervisa la operación de ADOMI desde un solo lugar." : "Gestiona la información de esta sección de forma rápida y segura."}</p></div>
                        <div className="adomi-admin__live"><span></span>Sistema activo</div>
                    </div>

                {vista === "resumen" && (
                    <>
                        <div className="row g-3 mb-4">
                            {[
                                ["todos", "Total pedidos", pedidos.length, "bi-bag-check", "text-primary"],
                                ["pendiente", "Pendientes", pedidosPendientes.length, "bi-hourglass", "text-secondary"],
                                ["aceptado", "Aceptados", pedidosAceptados.length, "bi-person-check", "text-primary"],
                                ["en camino", "En camino", pedidosEnCamino.length, "bi-truck", "text-warning"],
                                ["entregado", "Entregados", pedidosEntregados.length, "bi-check-circle", "text-success"],
                                ["cancelado", "Cancelados", pedidosCancelados.length, "bi-x-circle", "text-danger"],
                                ["incidencias", "Incidencias", incidenciasPendientes.length, "bi-exclamation-triangle", incidenciasPendientes.length > 0 ? "text-danger" : "text-secondary"]
                            ].map(([filtro, titulo, cantidad, icono, color]) => (
                                <div className="col-6 col-md-4 col-xl" key={filtro}>
                                    <button type="button" className="card border-0 shadow-sm rounded-4 h-100 w-100 text-start" onClick={() => abrirPedidosFiltrados(filtro)}>
                                        <div className="card-body p-3 p-md-4">
                                            <div className="d-flex justify-content-between align-items-start gap-2">
                                                <div><p className="text-muted small mb-1">{titulo}</p><h3 className={`fw-bold mb-0 ${color}`}>{cantidad}</h3></div>
                                                <i className={`bi ${icono} fs-4 ${color}`}></i>
                                            </div>
                                        </div>
                                    </button>
                                </div>
                            ))}
                        </div>

                        <div className="row g-4">
                            <div className="col-12 col-xl-7">
                                <div className="card border-0 shadow-sm rounded-4"><div className="card-body p-4">
                                    <h4 className="fw-bold mb-3">Estados de pedidos</h4>
                                    <ChartBox className="adomi-admin__chart--bar" height={280}>
                                        {(width, height) => (
                                            <BarChart width={width} height={height} data={pedidosChartData} margin={{ top: 10, right: 10, left: -15, bottom: 10 }}>
                                                <XAxis dataKey="name" interval={0} tick={{ fontSize: 11 }} />
                                                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                                                <Tooltip />
                                                <Bar dataKey="cantidad" radius={[10, 10, 0, 0]}>
                                                    {pedidosChartData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        )}
                                    </ChartBox>
                                </div></div>
                            </div>
                            <div className="col-12 col-xl-5">
                                <div className="card border-0 shadow-sm rounded-4"><div className="card-body p-4">
                                    <h4 className="fw-bold mb-3">Usuarios por rol</h4>
                                    <ChartBox className="adomi-admin__chart--pie" height={280}>
                                        {(width, height) => (
                                            <PieChart width={width} height={height}>
                                                <Pie
                                                    data={usuariosChartData}
                                                    dataKey="value"
                                                    nameKey="name"
                                                    cx="50%"
                                                    cy="50%"
                                                    outerRadius="70%"
                                                    label
                                                >
                                                    {usuariosChartData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                                    ))}
                                                </Pie>
                                                <Tooltip />
                                            </PieChart>
                                        )}
                                    </ChartBox>
                                </div></div>
                            </div>
                        </div>
                    </>
                )}

                {vista === "clientes" && (
                    <section className="adomi-admin__panel">
                        <div className="adomi-admin__section-head">
                            <div><span className="adomi-admin__eyebrow">Usuarios</span><h3>Clientes</h3><p>Consulta y administra las cuentas registradas.</p></div>
                            <span className="adomi-admin__count">{clientes.length} registrados</span>
                        </div>
                        <div className="adomi-admin__toolbar">
                            <div className="adomi-admin__search"><i className="bi bi-search"></i><input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por nombre o correo..." /></div>
                        </div>
                        <TablaUsuarios data={clientes.filter((u) => `${u.nombre} ${u.correo}`.toLowerCase().includes(busqueda.toLowerCase()))} />
                    </section>
                )}

                {vista === "repartidores" && (
                    <section className="adomi-admin__panel">
                        <div className="adomi-admin__section-head">
                            <div><span className="adomi-admin__eyebrow">Equipo</span><h3>Repartidores</h3><p>Gestiona el personal encargado de las entregas.</p></div>
                            <button className="btn btn-dark" onClick={() => setModalUsuario("repartidor")}><i className="bi bi-person-plus me-2"></i>Nuevo repartidor</button>
                        </div>
                        <div className="adomi-admin__toolbar">
                            <div className="adomi-admin__search"><i className="bi bi-search"></i><input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar repartidor..." /></div>
                            <span className="adomi-admin__count">{repartidores.length} registrados</span>
                        </div>
                        <TablaUsuarios data={repartidores.filter((u) => `${u.nombre} ${u.correo}`.toLowerCase().includes(busqueda.toLowerCase()))} />
                    </section>
                )}

                {vista === "administradores" && (
                    <section className="adomi-admin__panel">
                        <div className="adomi-admin__section-head">
                            <div><span className="adomi-admin__eyebrow">Seguridad</span><h3>Administradores</h3><p>Cuentas con acceso al panel administrativo.</p></div>
                            <button className="btn btn-dark" onClick={() => setModalUsuario("admin")}><i className="bi bi-shield-plus me-2"></i>Nuevo administrador</button>
                        </div>
                        <div className="adomi-admin__toolbar">
                            <div className="adomi-admin__search"><i className="bi bi-search"></i><input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar administrador..." /></div>
                            <span className="adomi-admin__count">{admins.length} registrados</span>
                        </div>
                        <TablaUsuarios data={admins.filter((u) => `${u.nombre} ${u.correo}`.toLowerCase().includes(busqueda.toLowerCase()))} />
                    </section>
                )}

                {vista === "pedidos" && (
                    <>
                        <div className="d-flex align-items-center justify-content-between flex-wrap gap-3 mb-3">
                            <div>
                                <h3 className="fw-bold mb-1">Pedidos</h3>
                                <p className="text-muted small mb-0">
                                    Consulta pedidos generales, actividad de repartidores y clientes frecuentes.
                                </p>
                            </div>

                            <div className="btn-group shadow-sm" role="group" aria-label="Vista de pedidos">
                                <button
                                    type="button"
                                    className={`btn ${modoPedidos === "todos" ? "btn-dark" : "btn-outline-dark"}`}
                                    onClick={() => cambiarModoPedidos("todos")}
                                    title="Todos los pedidos"
                                    aria-label="Todos los pedidos"
                                >
                                    <i className="bi bi-bag-check"></i>
                                    <span className="d-none d-lg-inline ms-2">Todos</span>
                                </button>
                                <button
                                    type="button"
                                    className={`btn ${modoPedidos === "repartidores" ? "btn-dark" : "btn-outline-dark"}`}
                                    onClick={() => cambiarModoPedidos("repartidores")}
                                    title="Pedidos por repartidor"
                                    aria-label="Pedidos por repartidor"
                                >
                                    <i className="bi bi-bicycle"></i>
                                    <span className="d-none d-lg-inline ms-2">Repartidores</span>
                                </button>
                                <button
                                    type="button"
                                    className={`btn ${modoPedidos === "clientes" ? "btn-dark" : "btn-outline-dark"}`}
                                    onClick={() => cambiarModoPedidos("clientes")}
                                    title="Pedidos por cliente"
                                    aria-label="Pedidos por cliente"
                                >
                                    <i className="bi bi-people"></i>
                                    <span className="d-none d-lg-inline ms-2">Clientes</span>
                                </button>
                            </div>
                        </div>

                        {modoPedidos === "todos" && (
                            <>
                                <div className="row g-3 mb-4">
                                    {[
                                        ["todos", "Total", pedidos.length, "bi-bag-check", "text-primary"],
                                        ["pendiente", "Pendientes", pedidosPendientes.length, "bi-hourglass", "text-secondary"],
                                        ["aceptado", "Aceptados", pedidosAceptados.length, "bi-person-check", "text-primary"],
                                        ["en camino", "En camino", pedidosEnCamino.length, "bi-truck", "text-warning"],
                                        ["entregado", "Entregados", pedidosEntregados.length, "bi-check-circle", "text-success"],
                                        ["cancelado", "Cancelados", pedidosCancelados.length, "bi-x-circle", "text-danger"]
                                    ].map(([filtro,titulo,cantidad,icono,color]) => (
                                        <div className="col-6 col-md-4 col-xl" key={filtro}>
                                            <button
                                                type="button"
                                                className={`card shadow-sm rounded-4 h-100 w-100 text-start ${filtroPedido === filtro ? "border border-primary" : "border-0"}`}
                                                onClick={() => { setFiltroPedido(filtro); setBusqueda(""); }}
                                            >
                                                <div className="card-body p-3">
                                                    <div className="d-flex justify-content-between align-items-center gap-2">
                                                        <div>
                                                            <p className="text-muted small mb-1">{titulo}</p>
                                                            <h3 className={`fw-bold mb-0 ${color}`}>{cantidad}</h3>
                                                        </div>
                                                        <i className={`bi ${icono} fs-4 ${color}`}></i>
                                                    </div>
                                                </div>
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                <div className="card border-0 shadow-sm rounded-4">
                                    <div className="card-body p-4">
                                        <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3 mb-4">
                                            <div>
                                                <h4 className="fw-bold mb-1">
                                                    {filtroPedido === "todos" ? "Todos los pedidos" : filtroPedido === "incidencias" ? "Pedidos con incidencia" : filtroPedido === "en camino" ? "Pedidos en camino" : `Pedidos ${filtroPedido}s`}
                                                </h4>
                                                <p className="text-muted small mb-0">{pedidosFiltrados.length} pedido(s) en esta categoría</p>
                                            </div>
                                            <div className="d-flex flex-column flex-sm-row gap-2">
                                                <input
                                                    type="search"
                                                    className="form-control"
                                                    placeholder="Buscar pedido..."
                                                    value={busqueda}
                                                    onChange={(e)=>setBusqueda(e.target.value)}
                                                />
                                                <button type="button" className="btn btn-outline-success text-nowrap" onClick={cargarDashboard}>
                                                    <i className="bi bi-arrow-clockwise me-1"></i>Actualizar
                                                </button>
                                            </div>
                                        </div>
                                        <TablaPedidos
                                            data={pedidosFiltrados.filter((p) =>
                                                `${p.id} ${p.cliente_nombre || ""} ${p.repartidor_nombre || ""} ${p.lugar_compra || ""} ${p.estado || ""}`
                                                    .toLowerCase()
                                                    .includes(busqueda.toLowerCase())
                                            )}
                                        />
                                    </div>
                                </div>
                            </>
                        )}

                        {modoPedidos === "repartidores" && (
                            <>
                                <div className="card border-0 shadow-sm rounded-4 mb-4">
                                    <div className="card-body p-3 p-md-4">
                                        <div className="d-flex flex-column flex-md-row justify-content-between gap-3 mb-3">
                                            <div>
                                                <h4 className="fw-bold mb-1">Pedidos por repartidor</h4>
                                                <p className="text-muted small mb-0">
                                                    Selecciona una tarjeta para consultar los pedidos y tiempos de cada repartidor.
                                                </p>
                                            </div>
                                            <input
                                                type="search"
                                                className="form-control"
                                                style={{ maxWidth: "300px" }}
                                                placeholder="Buscar repartidor..."
                                                value={busqueda}
                                                onChange={(e) => setBusqueda(e.target.value)}
                                            />
                                        </div>

                                        <div className="row g-3">
                                            {resumenRepartidoresPedidos
                                                .filter((item) => `${item.nombre} ${item.correo}`.toLowerCase().includes(busqueda.toLowerCase()))
                                                .map((item) => (
                                                    <div className="col-12 col-md-6 col-xl-4" key={item.id}>
                                                        <button
                                                            type="button"
                                                            className={`card w-100 h-100 text-start rounded-4 shadow-sm ${
                                                                Number(repartidorPedidosId) === Number(item.id)
                                                                    ? "border border-primary"
                                                                    : "border-0"
                                                            }`}
                                                            onClick={() => setRepartidorPedidosId(
                                                                Number(repartidorPedidosId) === Number(item.id) ? null : item.id
                                                            )}
                                                        >
                                                            <div className="card-body p-3">
                                                                <div className="d-flex justify-content-between align-items-start gap-2 mb-3">
                                                                    <div className="min-w-0">
                                                                        <div className="fw-bold text-truncate">{item.nombre}</div>
                                                                        <small className="text-muted text-truncate d-block">{item.correo}</small>
                                                                    </div>
                                                                    <span className="rounded-circle bg-light d-inline-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 38, height: 38 }}>
                                                                        <i className="bi bi-bicycle fs-5"></i>
                                                                    </span>
                                                                </div>

                                                                <div className="d-flex flex-wrap gap-2 mb-2">
                                                                    <span className="badge text-bg-dark">Asignados {item.asignados}</span>
                                                                    <span className="badge text-bg-success">Entregados {item.entregados}</span>
                                                                    <span className="badge text-bg-warning">Activos {item.activos}</span>
                                                                    <span className="badge text-bg-danger">Cancelados {item.cancelados}</span>
                                                                </div>

                                                                {item.cancelados > 0 && (
                                                                    <div className="d-flex flex-wrap gap-2 mb-2 small">
                                                                        <span className="text-danger fw-semibold">
                                                                            <i className="bi bi-bicycle me-1"></i>
                                                                            Por repartidor: {item.canceladosPorRepartidor}
                                                                        </span>
                                                                        <span className="text-danger fw-semibold">
                                                                            <i className="bi bi-person me-1"></i>
                                                                            Por cliente: {item.canceladosPorCliente}
                                                                        </span>
                                                                        {item.canceladosNoRegistrados > 0 && (
                                                                            <span className="text-muted">
                                                                                <i className="bi bi-question-circle me-1"></i>
                                                                                Antiguos sin registro: {item.canceladosNoRegistrados}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                )}

                                                                <div className="small text-muted">
                                                                    <span className="me-2">⚡ {item.rapidos}</span>
                                                                    <span className="me-2">✓ {item.normales}</span>
                                                                    <span className="me-2">⌛ {item.lentos}</span>
                                                                    <span>⚠ {item.atipicos}</span>
                                                                </div>
                                                            </div>
                                                        </button>
                                                    </div>
                                                ))}
                                        </div>
                                    </div>
                                </div>

                                {repartidorPedidosSeleccionado && (
                                    <div className="card border-0 shadow-sm rounded-4">
                                        <div className="card-body p-3 p-md-4">
                                            <div className="d-flex justify-content-between align-items-center gap-3 mb-3">
                                                <div>
                                                    <h4 className="fw-bold mb-1">{repartidorPedidosSeleccionado.nombre}</h4>
                                                    <p className="text-muted small mb-0">
                                                        {repartidorPedidosSeleccionado.pedidos.length} pedido(s) asociados
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-outline-secondary"
                                                    onClick={() => setRepartidorPedidosId(null)}
                                                    aria-label="Cerrar pedidos del repartidor"
                                                    title="Cerrar"
                                                >
                                                    <i className="bi bi-x-lg"></i>
                                                </button>
                                            </div>
                                            <TablaPedidos data={repartidorPedidosSeleccionado.pedidos} />
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {modoPedidos === "clientes" && (
                            <>
                                <div className="card border-0 shadow-sm rounded-4 mb-4">
                                    <div className="card-body p-3 p-md-4">
                                        <div className="d-flex flex-column flex-md-row justify-content-between gap-3 mb-3">
                                            <div>
                                                <h4 className="fw-bold mb-1">Clientes frecuentes</h4>
                                                <p className="text-muted small mb-0">
                                                    Ordenados por pedidos entregados para identificar clientes frecuentes y preparar promociones.
                                                </p>
                                            </div>
                                            <div className="d-flex flex-column flex-sm-row gap-2 align-items-stretch">
                                                <div className="dropdown">
                                                    <button
                                                        type="button"
                                                        className={`btn w-100 ${filtroPromocion > 0 ? "btn-warning" : "btn-outline-warning"}`}
                                                        data-bs-toggle="dropdown"
                                                        aria-expanded="false"
                                                        title="Filtrar candidatos para promociones"
                                                    >
                                                        <i className="bi bi-gift me-1"></i>
                                                        {filtroPromocion > 0 ? `${filtroPromocion}+ entregados` : "Promociones"}
                                                    </button>
                                                    <ul className="dropdown-menu dropdown-menu-end shadow border-0">
                                                        <li>
                                                            <button className="dropdown-item" type="button" onClick={() => setFiltroPromocion(0)}>
                                                                Todos los clientes
                                                            </button>
                                                        </li>
                                                        {[3, 5, 10].map((cantidad) => (
                                                            <li key={cantidad}>
                                                                <button
                                                                    className="dropdown-item"
                                                                    type="button"
                                                                    onClick={() => setFiltroPromocion(cantidad)}
                                                                >
                                                                    <i className="bi bi-gift me-2"></i>{cantidad}+ pedidos entregados
                                                                </button>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                                <input
                                                    type="search"
                                                    className="form-control"
                                                    style={{ minWidth: "220px", maxWidth: "300px" }}
                                                    placeholder="Buscar cliente..."
                                                    value={busqueda}
                                                    onChange={(e) => setBusqueda(e.target.value)}
                                                />
                                            </div>
                                        </div>

                                        {filtroPromocion > 0 && (
                                            <div className="alert alert-warning py-2 px-3 rounded-3 small mb-3">
                                                <i className="bi bi-gift-fill me-2"></i>
                                                Candidatos con <strong>{filtroPromocion} o más pedidos entregados</strong>:{" "}
                                                <strong>{clientesPromocion.length}</strong>
                                            </div>
                                        )}

                                        <div className="row g-3">
                                            {clientesPromocion
                                                .filter((item) => `${item.nombre} ${item.correo}`.toLowerCase().includes(busqueda.toLowerCase()))
                                                .map((item) => {
                                                    const posicion = resumenClientesPedidos.findIndex(
                                                        (cliente) => Number(cliente.id) === Number(item.id)
                                                    );
                                                    return (
                                                    <div className="col-12 col-md-6 col-xl-4" key={item.id}>
                                                        <button
                                                            type="button"
                                                            className={`card w-100 h-100 text-start rounded-4 shadow-sm ${
                                                                Number(clientePedidosId) === Number(item.id)
                                                                    ? "border border-primary"
                                                                    : "border-0"
                                                            }`}
                                                            onClick={() => setClientePedidosId(
                                                                Number(clientePedidosId) === Number(item.id) ? null : item.id
                                                            )}
                                                        >
                                                            <div className="card-body p-3">
                                                                <div className="d-flex justify-content-between align-items-start gap-2 mb-3">
                                                                    <div className="min-w-0">
                                                                        <div className="d-flex align-items-center gap-2 flex-wrap">
                                                                            <div className="fw-bold text-truncate">{item.nombre}</div>
                                                                            {posicion >= 0 && posicion < 3 && item.entregados > 0 && (
                                                                                <span className="badge text-bg-warning">
                                                                                    <i className="bi bi-star-fill me-1"></i>Top {posicion + 1}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <small className="text-muted text-truncate d-block">{item.correo}</small>
                                                                    </div>
                                                                    <span className="rounded-circle bg-light d-inline-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 38, height: 38 }}>
                                                                        <i className="bi bi-person-heart fs-5"></i>
                                                                    </span>
                                                                </div>

                                                                <div className="row g-2 text-center mb-2">
                                                                    <div className="col-4">
                                                                        <div className="border rounded-3 p-2">
                                                                            <div className="fw-bold">{item.realizados}</div>
                                                                            <small className="text-muted">Pedidos</small>
                                                                        </div>
                                                                    </div>
                                                                    <div className="col-4">
                                                                        <div className="border rounded-3 p-2">
                                                                            <div className="fw-bold text-success">{item.entregados}</div>
                                                                            <small className="text-muted">Entregados</small>
                                                                        </div>
                                                                    </div>
                                                                    <div className="col-4">
                                                                        <div className="border rounded-3 p-2">
                                                                            <div className="fw-bold text-danger">{item.cancelados}</div>
                                                                            <small className="text-muted">Cancelados</small>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <div className="d-flex justify-content-between align-items-center pt-2">
                                                                    <small className="text-muted">Total comprado</small>
                                                                    <span className="fw-bold text-success">Q {item.totalComprado.toFixed(2)}</span>
                                                                </div>
                                                            </div>
                                                        </button>
                                                    </div>
                                                    );
                                                })}
                                        </div>

                                        {clientesPromocion.filter((item) =>
                                            `${item.nombre} ${item.correo}`.toLowerCase().includes(busqueda.toLowerCase())
                                        ).length === 0 && (
                                            <div className="text-center py-5 text-muted">
                                                <i className="bi bi-gift fs-2 d-block mb-2"></i>
                                                No hay clientes que cumplan este filtro.
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {clientePedidosSeleccionado && (
                                    <div className="card border-0 shadow-sm rounded-4">
                                        <div className="card-body p-3 p-md-4">
                                            <div className="d-flex justify-content-between align-items-center gap-3 mb-3">
                                                <div>
                                                    <h4 className="fw-bold mb-1">{clientePedidosSeleccionado.nombre}</h4>
                                                    <p className="text-muted small mb-0">
                                                        {clientePedidosSeleccionado.pedidos.length} pedido(s) realizados · Q {clientePedidosSeleccionado.totalComprado.toFixed(2)} entregados
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-outline-secondary"
                                                    onClick={() => setClientePedidosId(null)}
                                                    aria-label="Cerrar pedidos del cliente"
                                                    title="Cerrar"
                                                >
                                                    <i className="bi bi-x-lg"></i>
                                                </button>
                                            </div>
                                            <TablaPedidos data={clientePedidosSeleccionado.pedidos} />
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </>
                )}

                {vista === "reportes" && (
    <section className="adomi-admin__panel">
        <div className="adomi-admin__section-head">
            <div>
                <span className="adomi-admin__eyebrow">Análisis</span>
                <h3>Reportes</h3>
                <p>
                    Consulta el rendimiento de ADOMI durante un período determinado.
                </p>
            </div>

            {reporte && (
                <span className="adomi-admin__count">
                    {reporte.resumen?.total_pedidos || 0} pedidos
                </span>
            )}
        </div>

        <div className="card border-0 shadow-sm rounded-4 mb-4 adomi-admin__report-filter">
            <div className="card-body p-3 p-md-4">
                <div className="row g-3 align-items-end adomi-admin__report-filter-row">
                    <div className="col-12 col-md-6 col-lg-3">
                        <label className="form-label fw-semibold">
                            Desde
                        </label>

                        <input
                            type="date"
                            className="form-control"
                            value={fechaInicioReporte}
                            max={fechaFinReporte}
                            onChange={(e) =>
                                setFechaInicioReporte(e.target.value)
                            }
                        />
                    </div>

                    <div className="col-12 col-md-6 col-lg-3">
                        <label className="form-label fw-semibold">
                            Hasta
                        </label>

                        <input
                            type="date"
                            className="form-control"
                            value={fechaFinReporte}
                            min={fechaInicioReporte}
                            onChange={(e) =>
                                setFechaFinReporte(e.target.value)
                            }
                        />
                    </div>

                    <div className="col-12 col-lg-6">
                        <div className="d-grid d-sm-flex gap-2 adomi-admin__report-actions">
                            <button
                                type="button"
                                className="btn btn-dark w-100"
                                onClick={handleGenerarReporte}
                                disabled={cargandoReporte}
                            >
                                {cargandoReporte ? (
                                    <>
                                        <span className="spinner-border spinner-border-sm me-2"></span>
                                        Generando...
                                    </>
                                ) : (
                                    <>
                                        <i className="bi bi-bar-chart-line me-2"></i>
                                        Generar reporte
                                    </>
                                )}
                            </button>

                            <button
                                type="button"
                                className="btn btn-danger w-100"
                                onClick={exportarReportePDF}
                                disabled={!reporte || cargandoReporte}
                            >
                                <i className="bi bi-file-earmark-pdf me-2"></i>
                                Generar PDF
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {!reporte && !cargandoReporte && (
            <div className="adomi-admin__empty">
                <i className="bi bi-bar-chart-line"></i>
                <strong>Genera tu primer reporte</strong>
                <span>
                    Selecciona un período para consultar la información.
                </span>
            </div>
        )}

        {reporte && (
            <>
                <div className="row g-3 mb-4 adomi-admin__report-kpis">
                    {[
                        ["Total pedidos", Number(reporte.resumen?.total_pedidos || 0), "bi-bag", "text-primary"],
                        ["Pendientes", Number((reporte.por_estado || []).find((r) => r.estado === "pendiente")?.total || 0), "bi-hourglass", "text-secondary"],
                        ["Aceptados", Number((reporte.por_estado || []).find((r) => r.estado === "aceptado")?.total || 0), "bi-person-check", "text-primary"],
                        ["En camino", Number((reporte.por_estado || []).find((r) => r.estado === "en camino")?.total || 0), "bi-truck", "text-warning"],
                        ["Entregados", Number((reporte.por_estado || []).find((r) => r.estado === "entregado")?.total || 0), "bi-check-circle", "text-success"],
                        ["Cancelados", Number((reporte.por_estado || []).find((r) => r.estado === "cancelado")?.total || 0), "bi-x-circle", "text-danger"],
                        ["Incidencias", Number(reporte.resumen?.incidencias_pendientes || 0), "bi-exclamation-triangle", "text-danger"]
                    ].map(([titulo, cantidad, icono, color]) => (
                        <div className="col-12 col-sm-6 col-xl-3" key={titulo}>
                            <div className="card border-0 shadow-sm rounded-4 h-100 adomi-admin__report-card">
                                <div className="card-body p-3 p-md-4">
                                    <div className="d-flex justify-content-between align-items-start gap-2">
                                        <div><p className="text-muted small mb-1">{titulo}</p><h3 className={`fw-bold mb-0 ${color}`}>{cantidad}</h3></div>
                                        <i className={`bi ${icono} fs-4 ${color}`}></i>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                    <div className="col-12 col-sm-6 col-xl-3">
                        <div className="card border-0 shadow-sm rounded-4 h-100 adomi-admin__report-card"><div className="card-body p-3 p-md-4">
                            <p className="text-muted small mb-1">Monto entregado</p>
                            <h3 className="fw-bold mb-0">Q {Number(reporte.resumen?.total_entregado || 0).toFixed(2)}</h3>
                        </div></div>
                    </div>
                </div>

                <div className="row g-4 mb-4 adomi-admin__report-charts">
                    <div className="col-12 col-xl-7">
                        <div className="card border-0 shadow-sm rounded-4 h-100 adomi-admin__report-card">
                            <div className="card-body p-3 p-md-4">
                                <h4 className="fw-bold mb-1">
                                    Pedidos por estado
                                </h4>

                                <p className="text-muted small mb-4">
                                    Distribución de los pedidos durante el período.
                                </p>

                                <ChartBox className="adomi-admin__chart--report" height={300}>
                                    {(width, height) => (
                                        <BarChart
                                            width={width}
                                            height={height}
                                            data={["pendiente", "aceptado", "en camino", "entregado", "cancelado"].map((estado) => {
                                                const item = (reporte.por_estado || []).find((registro) => registro.estado === estado);
                                                return { name: estado, cantidad: Number(item?.total || 0) };
                                            })}
                                        >
                                            <XAxis dataKey="name" />
                                            <YAxis
                                                allowDecimals={false}
                                            />
                                            <Tooltip />

                                            <Bar
                                                dataKey="cantidad"
                                                fill="#2563eb"
                                                radius={[8, 8, 0, 0]}
                                            />
                                        </BarChart>
                                    )}
                                </ChartBox>
                            </div>
                        </div>
                    </div>

                    <div className="col-12 col-xl-5">
                        <div className="card border-0 shadow-sm rounded-4 h-100 adomi-admin__report-card">
                            <div className="card-body p-3 p-md-4">
                                <h4 className="fw-bold mb-1">
                                    Tipo de servicio
                                </h4>

                                <p className="text-muted small mb-4">
                                    Pedidos realizados por categoría.
                                </p>

                                <ChartBox className="adomi-admin__chart--report" height={300}>
                                    {(width, height) => (
                                        <PieChart width={width} height={height}>
                                            <Pie
                                                data={(reporte.por_servicio || []).map(
                                                    (item) => ({
                                                        name:
                                                            item.tipo_servicio ||
                                                            "Sin especificar",
                                                        value: Number(item.total)
                                                    })
                                                )}
                                                dataKey="value"
                                                nameKey="name"
                                                outerRadius={95}
                                                label
                                            >
                                                {(reporte.por_servicio || []).map(
                                                    (_, index) => (
                                                        <Cell
                                                            key={index}
                                                            fill={
                                                                [
                                                                    "#2563eb",
                                                                    "#16a34a",
                                                                    "#f59e0b",
                                                                    "#7c3aed"
                                                                ][index % 4]
                                                            }
                                                        />
                                                    )
                                                )}
                                            </Pie>

                                            <Tooltip />
                                        </PieChart>
                                    )}
                                </ChartBox>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="card border-0 shadow-sm rounded-4 mb-4">
                    <div className="card-body p-3 p-md-4">
                        <div className="mb-4">
                            <h4 className="fw-bold mb-1">
                                Rendimiento de repartidores
                            </h4>

                            <p className="text-muted small mb-0">
                                Actividad registrada durante el período seleccionado.
                            </p>
                        </div>

                        <div className="table-responsive">
                            <table className="table align-middle">
                                <thead>
                                    <tr>
                                        <th>Repartidor</th>
                                        <th>Asignados</th>
                                        <th>Entregados</th>
                                        <th>Cancelados asignados</th>
                                        <th>Monto entregado</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {(reporte.repartidores || []).map(
                                        (repartidor) => (
                                            <tr key={repartidor.id}>
                                                <td>
                                                    <div className="fw-semibold">
                                                        {repartidor.nombre}
                                                    </div>

                                                    <small className="text-muted">
                                                        {repartidor.correo}
                                                    </small>
                                                </td>

                                                <td>
                                                    {Number(
                                                        repartidor.pedidos_asignados || 0
                                                    )}
                                                </td>

                                                <td>
                                                    <span className="badge bg-success">
                                                        {Number(
                                                            repartidor.entregados || 0
                                                        )}
                                                    </span>
                                                </td>

                                                <td>
                                                    <span className="badge bg-danger">
                                                        {Number(
                                                            repartidor.cancelados || 0
                                                        )}
                                                    </span>
                                                </td>

                                                <td className="fw-semibold">
                                                    Q{" "}
                                                    {Number(
                                                        repartidor.total_entregado || 0
                                                    ).toFixed(2)}
                                                </td>
                                            </tr>
                                        )
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div className="card border-0 shadow-sm rounded-4">
                    <div className="card-body p-3 p-md-4">
                        <div className="d-flex justify-content-between align-items-center gap-3 mb-4">
                            <div>
                                <h4 className="fw-bold mb-1">
                                    Pedidos del período
                                </h4>

                                <p className="text-muted small mb-0">
                                    Detalle utilizado para generar el reporte.
                                </p>
                            </div>

                            <span className="badge bg-dark">
                                {(reporte.pedidos || []).length}
                            </span>
                        </div>

                        <div className="table-responsive">
                            <table className="table align-middle">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Cliente</th>
                                        <th>Repartidor</th>
                                        <th>Servicio</th>
                                        <th>Estado</th>
                                        <th>Confirmación</th>
                                        <th>Total</th>
                                        <th>Fecha</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {(reporte.pedidos || []).map(
                                        (pedido) => (
                                            <tr key={pedido.id}>
                                                <td>#{pedido.id}</td>

                                                <td>
                                                    {pedido.cliente ||
                                                        "No disponible"}
                                                </td>

                                                <td>
                                                    {pedido.repartidor ||
                                                        "Sin asignar"}
                                                </td>

                                                <td className="text-capitalize">
                                                    {pedido.tipo_servicio}
                                                </td>

                                                <td>
                                                    <span
                                                        className={getEstadoBadge(
                                                            pedido.estado
                                                        )}
                                                    >
                                                        {pedido.estado}
                                                    </span>
                                                    {pedido.estado === "cancelado" && (
                                                        <small className={`d-block mt-1 ${getCanceladoPor(pedido).clase}`}>
                                                            <i className={`bi ${getCanceladoPor(pedido).icono} me-1`}></i>
                                                            Cancelado por: <strong>{getCanceladoPor(pedido).texto}</strong>
                                                        </small>
                                                    )}
                                                </td>

                                                <td>
                                                    {(() => {
                                                        const pedidoCompleto = pedidos.find(
                                                            (item) => Number(item.id) === Number(pedido.id)
                                                        );
                                                        const confirmacion = pedido.confirmacion_cliente ?? pedidoCompleto?.confirmacion_cliente ?? null;
                                                        const incidenciaResuelta = Number(
                                                            pedido.incidencia_resuelta ?? pedidoCompleto?.incidencia_resuelta ?? 0
                                                        ) === 1;

                                                        if (pedido.estado !== "entregado") {
                                                            return <span className="badge bg-light text-dark border">No aplica</span>;
                                                        }
                                                        if (confirmacion === "problema" && incidenciaResuelta) {
                                                            return <span className="badge bg-success">Resuelto</span>;
                                                        }
                                                        if (confirmacion === "confirmado") {
                                                            return <span className="badge bg-success">Confirmado</span>;
                                                        }
                                                        if (confirmacion === "problema") {
                                                            return <span className="badge bg-danger">Problema reportado</span>;
                                                        }
                                                        return <span className="badge bg-secondary">Sin confirmar</span>;
                                                    })()}
                                                </td>

                                                <td>
                                                    {formatearDinero(
                                                        pedido.total_real ??
                                                        pedido.total
                                                    )}
                                                </td>

                                                <td>
                                                    {formatearFecha(
                                                        pedido.created_at
                                                    )}
                                                </td>
                                            </tr>
                                        )
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </>
        )}
    </section>
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
            </div>

            <div className="adomi-admin__fab-wrap">
                <div className="adomi-admin__fab-menu">
                    <button onClick={() => setModalUsuario("repartidor")}><span>Nuevo repartidor</span><i className="bi bi-bicycle"></i></button>
                    <button onClick={() => setModalUsuario("admin")}><span>Nuevo administrador</span><i className="bi bi-shield-plus"></i></button>
                    <button onClick={() => setVista("pedidos")}><span>Ver pedidos</span><i className="bi bi-bag-check"></i></button>
                </div>
                <button className="adomi-admin__fab" aria-label="Acciones rápidas"><i className="bi bi-plus-lg"></i></button>
            </div>

            {modalUsuario && (
                <div className="adomi-admin__overlay" onClick={() => setModalUsuario(null)}>
                    <div className="adomi-admin__modal-card" onClick={(e) => e.stopPropagation()}>
                        <div className="adomi-admin__modal-head"><div><span className="adomi-admin__eyebrow">Nueva cuenta</span><h3>{modalUsuario === "admin" ? "Crear administrador" : "Crear repartidor"}</h3></div><button className="btn-close" onClick={() => setModalUsuario(null)}></button></div>
                        {modalUsuario === "repartidor" ? (
                            <form onSubmit={handleCrearRepartidor}>
                                <label className="form-label fw-semibold">Nombre</label><input className="form-control mb-3" value={nombreRepartidor} onChange={(e) => setNombreRepartidor(e.target.value)} required />
                                <label className="form-label fw-semibold">Correo</label><input type="email" className="form-control mb-3" value={correoRepartidor} onChange={(e) => setCorreoRepartidor(e.target.value)} required />
                                <label className="form-label fw-semibold">Contraseña</label><input type="password" minLength="8" maxLength="72" className="form-control mb-4" value={passwordRepartidor} onChange={(e) => setPasswordRepartidor(e.target.value)} required />
                                <div className="d-flex gap-2 justify-content-end"><button type="button" className="btn btn-light" onClick={() => setModalUsuario(null)}>Cancelar</button><button className="btn btn-dark">Crear repartidor</button></div>
                            </form>
                        ) : (
                            <form onSubmit={handleCrearAdmin}>
                                <label className="form-label fw-semibold">Nombre</label><input className="form-control mb-3" value={nombreAdmin} onChange={(e) => setNombreAdmin(e.target.value)} minLength="2" maxLength="100" required disabled={creandoAdmin} />
                                <label className="form-label fw-semibold">Correo</label><input type="email" className="form-control mb-3" value={correoAdmin} onChange={(e) => setCorreoAdmin(e.target.value)} required disabled={creandoAdmin} />
                                <label className="form-label fw-semibold">Contraseña</label><input type="password" className="form-control mb-4" value={passwordAdmin} onChange={(e) => setPasswordAdmin(e.target.value)} minLength="8" maxLength="72" required disabled={creandoAdmin} />
                                <div className="d-flex gap-2 justify-content-end"><button type="button" className="btn btn-light" onClick={() => setModalUsuario(null)} disabled={creandoAdmin}>Cancelar</button><button className="btn btn-dark" disabled={creandoAdmin}>{creandoAdmin ? "Creando..." : "Crear administrador"}</button></div>
                            </form>
                        )}
                    </div>
                </div>
            )}

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
                                        {pedidoDetalle.estado === "cancelado" && (
                                            <span className="badge bg-light text-dark border">
                                                <i className={`bi ${getCanceladoPor(pedidoDetalle).icono} me-1`}></i>
                                                Cancelado por: {getCanceladoPor(pedidoDetalle).texto}
                                            </span>
                                        )}
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

                            <div className="border rounded-4 p-3 p-md-4 mb-4">
                                <div className="d-flex align-items-center gap-2 mb-3">
                                    <i className="bi bi-clock-history fs-5 text-primary"></i>
                                    <div>
                                        <div className="fw-bold">Tiempo del pedido</div>
                                        <small className="text-muted">Desde que el cliente realizó el pedido hasta su entrega</small>
                                    </div>
                                </div>

                                <div className="row g-3">
                                    <div className="col-12 col-md-4">
                                        <small className="text-muted d-block">Realizado</small>
                                        <strong>{formatearFecha(pedidoDetalle.created_at)}</strong>
                                    </div>
                                    <div className="col-12 col-md-4">
                                        <small className="text-muted d-block">Entregado</small>
                                        <strong>{pedidoDetalle.fecha_entrega ? formatearFecha(pedidoDetalle.fecha_entrega) : "Pendiente"}</strong>
                                    </div>
                                    <div className="col-12 col-md-4">
                                        <small className="text-muted d-block">Tiempo total</small>
                                        <strong className={pedidoDetalle.estado === "entregado" ? "text-primary" : "text-muted"}>
                                            {formatearTiempoPedido(calcularTiempoTotalPedido(pedidoDetalle))}
                                        </strong>
                                    </div>
                                </div>
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