import { useEffect, useState } from "react";
import {
    getMessagesByOrder,
    sendMessage
} from "../services/messageService";

function OrderChat({ pedidoId }) {

    const user = JSON.parse(
        localStorage.getItem("user")
    );

    const [mensajes, setMensajes] =
        useState([]);

    const [mensaje, setMensaje] =
        useState("");

    const [error, setError] =
        useState("");

    const [enviando, setEnviando] =
        useState(false);


    // ==========================================
    // MENSAJES RÁPIDOS SEGÚN EL ROL
    // ==========================================

    const mensajesRepartidor = [
        {
            icono: "",
            texto: "Voy en camino"
        },
        {
            icono: "",
            texto: "Ya estoy en el lugar de compra"
        },
        {
            icono: "",
            texto: "Ya recogí tu pedido"
        },
        {
            icono: "",
            texto: "Estoy cerca de tu ubicación"
        },
    ];


    const mensajesCliente = [
        {
            icono: "",
            texto: "Gracias, estoy pendiente"
        },
        {
            icono: "",
            texto: "¿Cuánto falta aproximadamente?"
        },
        {
            icono: "",
            texto: "Estoy en la ubicación indicada"
        },
        {
            icono: "",
            texto: "Estoy en la entrada"
        },
        {
            icono: "",
            texto: "Llámame cuando llegues"
        },
        {
            icono: "",
            texto: "Perfecto, gracias"
        }
    ];


    const mensajesRapidos =
        user?.rol === "repartidor"
            ? mensajesRepartidor
            : mensajesCliente;


    // ==========================================
    // CARGAR MENSAJES
    // ==========================================

    const cargarMensajes = async () => {

        try {

            const data =
                await getMessagesByOrder(
                    pedidoId
                );

            setMensajes(
                data.mensajes || []
            );

            setError("");

        } catch (error) {

            console.error(error);

            setError(
                "No se pudieron cargar los mensajes"
            );
        }
    };


    // ==========================================
    // ACTUALIZACIÓN AUTOMÁTICA
    // ==========================================

    useEffect(() => {

        if (!pedidoId) {
            return;
        }

        cargarMensajes();

        const interval =
            setInterval(() => {

                cargarMensajes();

            }, 5000);


        return () =>
            clearInterval(interval);

    }, [pedidoId]);


    // ==========================================
    // SELECCIONAR MENSAJE RÁPIDO
    // ==========================================

    const seleccionarMensajeRapido =
        (texto) => {

            setMensaje(texto);

            setError("");
        };


    // ==========================================
    // ENVIAR MENSAJE
    // ==========================================

    const enviarMensaje = async (e) => {

        e.preventDefault();

        const mensajeLimpio =
            mensaje.trim();

        if (!mensajeLimpio) {
            return;
        }

        if (enviando) {
            return;
        }


        try {

            setEnviando(true);

            await sendMessage(
                pedidoId,
                mensajeLimpio
            );

            setMensaje("");

            setError("");

            await cargarMensajes();

        } catch (error) {

            console.error(error);

            setError(
                "No se pudo enviar el mensaje"
            );

        } finally {

            setEnviando(false);
        }
    };


    return (

        <div>

            {/* ERROR */}

            {error && (

                <div className="alert alert-danger py-2">

                    <i className="bi bi-exclamation-triangle me-2"></i>

                    {error}

                </div>

            )}


            {/* MENSAJES */}

            <div
                className="border rounded-4 p-3 bg-light mb-3"
                style={{
                    maxHeight: "260px",
                    overflowY: "auto"
                }}
            >

                {mensajes.length === 0 ? (

                    <p className="text-muted text-center mb-0">

                        No hay mensajes todavía.

                    </p>

                ) : (

                    mensajes.map((item) => {

                        const esMio =
                            item.usuario_id ===
                            user?.id;

                        return (

                            <div
                                key={item.id}
                                className={`mb-3 d-flex ${
                                    esMio
                                        ? "justify-content-end"
                                        : "justify-content-start"
                                }`}
                            >

                                <div
                                    className={`p-2 rounded-3 ${
                                        esMio
                                            ? "bg-primary text-white"
                                            : "bg-white border"
                                    }`}
                                    style={{
                                        maxWidth: "85%"
                                    }}
                                >

                                    <small
                                        className={
                                            esMio
                                                ? "text-white-50"
                                                : "text-muted"
                                        }
                                    >

                                        {item.usuario_nombre}
                                        {" · "}
                                        {item.usuario_rol}

                                    </small>


                                    <p
                                        className="mb-1"
                                        style={{
                                            overflowWrap:
                                                "anywhere"
                                        }}
                                    >

                                        {item.mensaje}

                                    </p>


                                    <small
                                        className={
                                            esMio
                                                ? "text-white-50"
                                                : "text-muted"
                                        }
                                    >

                                        {new Date(
                                            item.fecha
                                        ).toLocaleString()}

                                    </small>

                                </div>

                            </div>

                        );
                    })

                )}

            </div>


            {/* RESPUESTAS RÁPIDAS */}

            <div className="mb-3">

                <div className="d-flex align-items-center mb-2">

                    <i className="bi bi-lightning-charge-fill text-warning me-2"></i>

                    <small className="fw-semibold">

                        Respuestas rápidas

                    </small>

                </div>


                <div className="d-flex flex-wrap gap-2">

                    {mensajesRapidos.map(
                        (opcion, index) => (

                            <button
                                key={index}
                                type="button"
                                className="btn btn-outline-secondary btn-sm rounded-pill"
                                onClick={() =>
                                    seleccionarMensajeRapido(
                                        opcion.texto
                                    )
                                }
                            >

                                <span className="me-1">
                                    {opcion.icono}
                                </span>

                                {opcion.texto}

                            </button>

                        )
                    )}

                </div>

            </div>


            {/* ESCRIBIR MENSAJE */}

            <form onSubmit={enviarMensaje}>

                <div className="input-group">

                    <input
                        type="text"
                        className="form-control"
                        placeholder="Escribe un mensaje..."
                        value={mensaje}
                        maxLength="500"
                        onChange={(e) =>
                            setMensaje(
                                e.target.value
                            )
                        }
                    />


                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={
                            enviando ||
                            !mensaje.trim()
                        }
                    >

                        {enviando ? (

                            <>
                                <span className="spinner-border spinner-border-sm me-2"></span>

                                <span className="d-none d-sm-inline">
                                    Enviando...
                                </span>
                            </>

                        ) : (

                            <>
                                <i className="bi bi-send me-sm-2"></i>

                                <span className="d-none d-sm-inline">
                                    Enviar
                                </span>
                            </>

                        )}

                    </button>

                </div>

            </form>

        </div>
    );
}

export default OrderChat;