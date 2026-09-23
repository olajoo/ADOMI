import { useEffect, useState } from "react";
import { loginUser } from "../services/authService";
import "./Login.css";

function Login() {
    const [correo, setCorreo] = useState("");
    const [password, setPassword] = useState("");
    const [mensaje, setMensaje] = useState("");
    const [cargando, setCargando] = useState(false);
    const [mostrarPassword, setMostrarPassword] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem("token");
        const userData = localStorage.getItem("user");

        if (token && userData) {
            try {
                const user = JSON.parse(userData);

                if (user.rol === "admin") {
                    window.location.href = "/admin";
                } else if (user.rol === "cliente") {
                    window.location.href = "/cliente";
                } else if (user.rol === "repartidor") {
                    window.location.href = "/repartidor";
                }
            } catch (error) {
                localStorage.clear();
            }
        }
    }, []);

    const handleLogin = async (e) => {
        e.preventDefault();

        setMensaje("");
        setCargando(true);

        try {
            const data = await loginUser(correo, password);

            localStorage.setItem("token", data.token);
            localStorage.setItem("user", JSON.stringify(data.user));

            if (data.user.rol === "admin") {
                window.location.href = "/admin";
            } else if (data.user.rol === "cliente") {
                window.location.href = "/cliente";
            } else if (data.user.rol === "repartidor") {
                window.location.href = "/repartidor";
            } else {
                setMensaje("Rol no reconocido");
            }
        } catch (error) {
            setMensaje(
                error.response?.data?.message || "Error al iniciar sesión"
            );
        } finally {
            setCargando(false);
        }
    };

    return (
        <main className="adomi-login">
            <section className="adomi-login__hero" aria-hidden="true">
                <div className="adomi-login__hero-content">
                    <div className="adomi-login__brand adomi-login__brand--light">
                        <span className="adomi-login__brand-icon">
                            <i className="bi bi-bag-check-fill"></i>
                        </span>
                        <span>ADOMI</span>
                    </div>

                    <div className="adomi-login__hero-copy">
                        <span className="adomi-login__eyebrow">
                            Delivery simple y organizado
                        </span>

                        <h1>
                            Tus pedidos,
                            <br />
                            en un solo lugar.
                        </h1>

                        <p>
                            Solicita comida o abarrotes, sigue tu pedido y
                            mantente comunicado durante la entrega.
                        </p>

                        <div className="adomi-login__features">
                            <span>
                                <i className="bi bi-shop"></i>
                                Restaurantes y abarrotes
                            </span>
                            <span>
                                <i className="bi bi-geo-alt"></i>
                                Seguimiento de entregas
                            </span>
                            <span>
                                <i className="bi bi-chat-dots"></i>
                                Comunicación en tiempo real
                            </span>
                        </div>
                    </div>

                    <p className="adomi-login__hero-footer">
                        ADOMI · Gestión de pedidos a domicilio
                    </p>
                </div>

                <div className="adomi-login__shape adomi-login__shape--one"></div>
                <div className="adomi-login__shape adomi-login__shape--two"></div>
            </section>

            <section className="adomi-login__panel">
                <div className="adomi-login__form-wrap">
                    <div className="adomi-login__mobile-brand">
                        <span className="adomi-login__brand-icon">
                            <i className="bi bi-bag-check-fill"></i>
                        </span>
                        <span>ADOMI</span>
                    </div>

                    <div className="adomi-login__heading">
                        <span className="adomi-login__eyebrow adomi-login__eyebrow--dark">
                            Bienvenido
                        </span>
                        <h2>Inicia sesión</h2>
                        <p>
                            Ingresa tus datos para continuar a tu cuenta.
                        </p>
                    </div>

                    {mensaje && (
                        <div
                            className="adomi-login__alert"
                            role="alert"
                        >
                            <i className="bi bi-exclamation-circle"></i>
                            <span>{mensaje}</span>
                        </div>
                    )}

                    <form
                        className="adomi-login__form"
                        onSubmit={handleLogin}
                    >
                        <div className="adomi-login__field">
                            <label htmlFor="correo">
                                Correo electrónico
                            </label>

                            <div className="adomi-login__input">
                                <i className="bi bi-envelope"></i>

                                <input
                                    id="correo"
                                    type="email"
                                    autoComplete="email"
                                    placeholder="correo@ejemplo.com"
                                    value={correo}
                                    onChange={(e) =>
                                        setCorreo(e.target.value)
                                    }
                                    required
                                />
                            </div>
                        </div>

                        <div className="adomi-login__field">
                            <label htmlFor="password">
                                Contraseña
                            </label>

                            <div className="adomi-login__input">
                                <i className="bi bi-lock"></i>

                                <input
                                    id="password"
                                    type={
                                        mostrarPassword
                                            ? "text"
                                            : "password"
                                    }
                                    autoComplete="current-password"
                                    placeholder="Ingresa tu contraseña"
                                    value={password}
                                    onChange={(e) =>
                                        setPassword(e.target.value)
                                    }
                                    required
                                />

                                <button
                                    type="button"
                                    className="adomi-login__password-toggle"
                                    onClick={() =>
                                        setMostrarPassword(
                                            (actual) => !actual
                                        )
                                    }
                                    aria-label={
                                        mostrarPassword
                                            ? "Ocultar contraseña"
                                            : "Mostrar contraseña"
                                    }
                                    title={
                                        mostrarPassword
                                            ? "Ocultar contraseña"
                                            : "Mostrar contraseña"
                                    }
                                >
                                    <i
                                        className={`bi ${
                                            mostrarPassword
                                                ? "bi-eye-slash"
                                                : "bi-eye"
                                        }`}
                                    ></i>
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="adomi-login__submit"
                            disabled={cargando}
                        >
                            {cargando ? (
                                <>
                                    <span
                                        className="spinner-border spinner-border-sm"
                                        aria-hidden="true"
                                    ></span>
                                    Ingresando...
                                </>
                            ) : (
                                <>
                                    Iniciar sesión
                                    <i className="bi bi-arrow-right"></i>
                                </>
                            )}
                        </button>
                    </form>

                    <div className="adomi-login__register">
                        <span>¿Aún no tienes una cuenta?</span>
                        <button
                            type="button"
                            onClick={() =>
                                (window.location.href = "/registro")
                            }
                        >
                            Crear cuenta
                        </button>
                    </div>

                    <div className="adomi-login__security">
                        <i className="bi bi-shield-check"></i>
                        <span>Acceso seguro a ADOMI</span>
                    </div>
                </div>
            </section>
        </main>
    );
}

export default Login;
