import { useEffect, useState } from "react";
import {
    getMessagesByOrder,
    sendMessage
} from "../services/messageService";
import "./OrderChat.css";

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

        <div className="adomi-chat">

            {/* ERROR */}

            {error && (

                <div className="alert alert-danger py-2 adomi-chat__alert">

                    <i className="bi bi-exclamation-triangle me-2"></i>

                    {error}

                </div>

            )}


            {/* MENSAJES */}

            <div
                className="adomi-chat__messages"
            >

                {mensajes.length === 0 ? (

                    <p className="adomi-chat__empty">

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
                                className={`adomi-chat__row ${
                                    esMio
                                        ? "adomi-chat__row--mine"
                                        : "adomi-chat__row--other"
                                }`}
                            >

                                <div
                                    className={`adomi-chat__bubble ${
                                        esMio
                                            ? "adomi-chat__bubble--mine"
                                            : "adomi-chat__bubble--other"
                                    }`}
                                >

                                    <small
                                        className="adomi-chat__meta"
                                    >

                                        {item.usuario_nombre}
                                        {" · "}
                                        {item.usuario_rol}

                                    </small>


                                    <p
                                        className="adomi-chat__text"
                                    >

                                        {item.mensaje}

                                    </p>


                                    <small
                                        className="adomi-chat__meta"
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

            <div className="adomi-chat__quick">

                <div className="adomi-chat__quick-title">

                    <i className="bi bi-lightning-charge-fill text-warning me-2"></i>

                    <small className="fw-semibold">

                        Respuestas rápidas

                    </small>

                </div>


                <div className="adomi-chat__quick-list">

                    {mensajesRapidos.map(
                        (opcion, index) => (

                            <button
                                key={index}
                                type="button"
                                className="adomi-chat__quick-button"
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

            <form className="adomi-chat__form" onSubmit={enviarMensaje}>

                <div className="adomi-chat__composer">

                    <input
                        type="text"
                        className="adomi-chat__input"
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
                        className="adomi-chat__send"
                        aria-label="Enviar mensaje"
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