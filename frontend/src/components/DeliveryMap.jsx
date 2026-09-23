import {
    MapContainer,
    TileLayer,
    Marker,
    Popup,
    useMap
} from "react-leaflet";

import { useEffect } from "react";
import L from "leaflet";
import "./DeliveryMap.css";


// ======================================================
// ICONO DEL CLIENTE
// ======================================================

const clienteIcon = new L.Icon({
    iconUrl:
        "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",

    shadowUrl:
        "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",

    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});


// ======================================================
// ICONO DEL REPARTIDOR
// ======================================================

const repartidorIcon = L.divIcon({
    className: "adomi-map__driver-marker",
    html: `
        <div class="adomi-map__driver-marker-inner">
            <i class="bi bi-scooter"></i>
        </div>
    `,
    iconSize: [42, 42],
    iconAnchor: [21, 21],
    popupAnchor: [0, -23]
});


// ======================================================
// VALIDAR COORDENADAS
// ======================================================

const coordenadaValida = (latitud, longitud) => {

    const lat = Number(latitud);
    const lng = Number(longitud);

    return (
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        lat >= -90 &&
        lat <= 90 &&
        lng >= -180 &&
        lng <= 180
    );
};


// ======================================================
// AJUSTAR EL MAPA CUANDO CAMBIAN LAS COORDENADAS
// ======================================================

function AjustarMapa({
    cliente,
    repartidor
}) {

    const map = useMap();


    useEffect(() => {

        const puntos = [];


        if (
            cliente &&
            coordenadaValida(
                cliente.latitud,
                cliente.longitud
            )
        ) {

            puntos.push([
                Number(cliente.latitud),
                Number(cliente.longitud)
            ]);
        }


        if (
            repartidor &&
            coordenadaValida(
                repartidor.latitud,
                repartidor.longitud
            )
        ) {

            puntos.push([
                Number(repartidor.latitud),
                Number(repartidor.longitud)
            ]);
        }


        if (puntos.length === 1) {

            map.setView(
                puntos[0],
                16
            );

            return;
        }


        if (puntos.length > 1) {

            const bounds =
                L.latLngBounds(puntos);

            map.fitBounds(
                bounds,
                {
                    padding: [50, 50],
                    maxZoom: 16
                }
            );
        }

    }, [
        cliente,
        repartidor,
        map
    ]);


    return null;
}


// ======================================================
// COMPONENTE PRINCIPAL
// ======================================================

function DeliveryMap({
    latitud,
    longitud,

    titulo = "Ubicación",

    tipo = "cliente",

    cliente = null,

    repartidor = null,

    mostrarRuta = false,

    altura = "300px"
}) {


    /*
        COMPATIBILIDAD CON EL CÓDIGO ANTERIOR

        Esto permite seguir utilizando:

        <DeliveryMap
            latitud={...}
            longitud={...}
        />

        sin romper las pantallas existentes.
    */


    let clienteFinal = cliente;
    let repartidorFinal = repartidor;


    if (
        !cliente &&
        !repartidor &&
        coordenadaValida(
            latitud,
            longitud
        )
    ) {

        if (tipo === "repartidor") {

            repartidorFinal = {
                latitud:
                    Number(latitud),

                longitud:
                    Number(longitud)
            };

        } else {

            clienteFinal = {
                latitud:
                    Number(latitud),

                longitud:
                    Number(longitud)
            };
        }
    }


    // ==================================================
    // VALIDAR SI EXISTE ALGÚN PUNTO
    // ==================================================

    const clienteValido =
        clienteFinal &&
        coordenadaValida(
            clienteFinal.latitud,
            clienteFinal.longitud
        );


    const repartidorValido =
        repartidorFinal &&
        coordenadaValida(
            repartidorFinal.latitud,
            repartidorFinal.longitud
        );


    if (
        !clienteValido &&
        !repartidorValido
    ) {

        return (

            <div className="adomi-map__empty">
                <span className="adomi-map__empty-icon">
                    <i className="bi bi-geo-alt"></i>
                </span>
                <div className="fw-semibold mt-2">
                    Ubicación no disponible
                </div>
                <small className="text-muted">
                    Todavía no existen coordenadas válidas para mostrar.
                </small>
            </div>
        );
    }


    // ==================================================
    // CENTRO INICIAL
    // ==================================================

    let centroInicial;


    if (clienteValido) {

        centroInicial = [
            Number(
                clienteFinal.latitud
            ),

            Number(
                clienteFinal.longitud
            )
        ];

    } else {

        centroInicial = [
            Number(
                repartidorFinal.latitud
            ),

            Number(
                repartidorFinal.longitud
            )
        ];
    }


    // ==================================================
    // ABRIR NAVEGACIÓN
    // ==================================================

    const abrirRuta = () => {

        if (!clienteValido) {
            return;
        }


        const lat =
            Number(
                clienteFinal.latitud
            );

        const lng =
            Number(
                clienteFinal.longitud
            );


        /*
            Abre Google Maps.

            En celular normalmente permitirá
            abrir la aplicación de Maps.

            El punto de inicio se obtiene
            automáticamente desde la ubicación
            actual del repartidor.
        */

        const url =
            `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;


        window.open(
            url,
            "_blank",
            "noopener,noreferrer"
        );
    };


    // ==================================================
    // RENDER
    // ==================================================

    return (

        <div className="w-100 adomi-map">


            {/* ENCABEZADO OPCIONAL */}

            {titulo && (

                <div className="adomi-map__header">

                    <div className="adomi-map__title">

                        <i className="bi bi-geo-alt-fill text-danger me-2"></i>

                        {titulo}

                    </div>


                    {clienteValido &&
                        repartidorValido && (

                            <small className="text-muted">

                                Seguimiento

                            </small>

                        )}

                </div>

            )}


            {/* MAPA */}

            <div
                className="adomi-map__canvas"
                style={{
                    "--adomi-map-height": altura
                }}
            >

                <MapContainer
                    center={
                        centroInicial
                    }

                    zoom={16}

                    scrollWheelZoom={
                        true
                    }

                    className="adomi-map__leaflet"
                >


                    {/* OPENSTREETMAP */}

                    <TileLayer
                        attribution='&copy; OpenStreetMap contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />


                    {/* AJUSTAR MAPA */}

                    <AjustarMapa
                        cliente={
                            clienteValido
                                ? clienteFinal
                                : null
                        }

                        repartidor={
                            repartidorValido
                                ? repartidorFinal
                                : null
                        }
                    />


                    {/* CLIENTE */}

                    {clienteValido && (

                        <Marker
                            position={[
                                Number(
                                    clienteFinal.latitud
                                ),

                                Number(
                                    clienteFinal.longitud
                                )
                            ]}

                            icon={
                                clienteIcon
                            }
                        >

                            <Popup>

                                <div>

                                    <strong>

                                        <i className="bi bi-geo-alt-fill me-1 text-danger"></i> Punto de entrega

                                    </strong>


                                    <br />


                                    <small>

                                        Ubicación exacta indicada por el cliente.

                                    </small>

                                </div>

                            </Popup>

                        </Marker>

                    )}


                    {/* REPARTIDOR */}

                    {repartidorValido && (

                        <Marker
                            position={[
                                Number(
                                    repartidorFinal.latitud
                                ),

                                Number(
                                    repartidorFinal.longitud
                                )
                            ]}

                            icon={
                                repartidorIcon
                            }
                        >

                            <Popup>

                                <div>

                                    <strong>

                                        <i className="bi bi-scooter me-1 text-primary"></i> Repartidor

                                    </strong>


                                    <br />


                                    <small>

                                        Última ubicación registrada.

                                    </small>

                                </div>

                            </Popup>

                        </Marker>

                    )}

                </MapContainer>

            </div>


            {/* LEYENDA */}

            {clienteValido &&
                repartidorValido && (

                    <div className="d-flex flex-wrap gap-3 mt-2">

                        <small>

                            📍 Punto de entrega

                        </small>


                        <small>

                            🚗 Repartidor

                        </small>

                    </div>

                )}


            {/* BOTÓN ABRIR RUTA */}

            {mostrarRuta &&
                clienteValido && (

                    <button
                        type="button"

                        className="adomi-map__route-button"

                        onClick={
                            abrirRuta
                        }
                    >

                        <i className="bi bi-sign-turn-right-fill me-2"></i>

                        Abrir ruta hasta el cliente

                    </button>

                )}

        </div>
    );
}


export default DeliveryMap;