import { useMemo, useState } from "react";
import { resetPassword } from "../services/authService";
import "./Login.css";

function ResetPassword() {
    const token = useMemo(
        () => new URLSearchParams(window.location.search).get("token") || "",
        []
    );

    const [password, setPassword] = useState("");
    const [confirmarPassword, setConfirmarPassword] = useState("");
    const [mostrarPassword, setMostrarPassword] = useState(false);
    const [cargando, setCargando] = useState(false);
    const [mensaje, setMensaje] = useState("");
    const [error, setError] = useState("");
    const [completado, setCompletado] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMensaje("");
        setError("");

        if (!token) {
            setError("El enlace de recuperación no contiene un token válido.");
            return;
        }

        if (password.length < 8 || password.length > 72) {
            setError("La contraseña debe tener entre 8 y 72 caracteres.");
            return;
        }

        if (password !== confirmarPassword) {
            setError("Las contraseñas no coinciden.");
            return;
        }

        setCargando(true);

        try {
            const data = await resetPassword(token, password);
            setMensaje(data.message || "Contraseña actualizada correctamente");
            setCompletado(true);
            setPassword("");
            setConfirmarPassword("");
        } catch (err) {
            setError(
                err.response?.data?.message ||
                    "No fue posible restablecer la contraseña"
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
                            Seguridad de tu cuenta
                        </span>
                        <h1>
                            Crea una nueva
                            <br />
                            contraseña.
                        </h1>
                        <p>
                            Protege tu cuenta con una contraseña que solo tú conozcas.
                        </p>
                        <div className="adomi-login__features">
                            <span><i className="bi bi-shield-lock"></i>Enlace temporal</span>
                            <span><i className="bi bi-clock"></i>Válido por 15 minutos</span>
                            <span><i className="bi bi-check-circle"></i>Uso único</span>
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
                            Recuperación
                        </span>
                        <h2>Nueva contraseña</h2>
                        <p>
                            Ingresa y confirma la contraseña que utilizarás para
                            iniciar sesión.
                        </p>
                    </div>

                    {!token && (
                        <div className="adomi-login__alert" role="alert">
                            <i className="bi bi-exclamation-circle"></i>
                            <span>Este enlace de recuperación no es válido.</span>
                        </div>
                    )}

                    {error && (
                        <div className="adomi-login__alert" role="alert">
                            <i className="bi bi-exclamation-circle"></i>
                            <span>{error}</span>
                        </div>
                    )}

                    {mensaje && (
                        <div className="alert alert-success border-0 rounded-4">
                            <i className="bi bi-check-circle me-2"></i>
                            {mensaje}
                        </div>
                    )}

                    {!completado && token ? (
                        <form className="adomi-login__form" onSubmit={handleSubmit}>
                            <div className="adomi-login__field">
                                <label htmlFor="nuevaPassword">Nueva contraseña</label>
                                <div className="adomi-login__input">
                                    <i className="bi bi-lock"></i>
                                    <input
                                        id="nuevaPassword"
                                        type={mostrarPassword ? "text" : "password"}
                                        autoComplete="new-password"
                                        placeholder="Mínimo 8 caracteres"
                                        minLength="8"
                                        maxLength="72"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                    />
                                    <button
                                        type="button"
                                        className="adomi-login__password-toggle"
                                        onClick={() => setMostrarPassword((actual) => !actual)}
                                        aria-label={mostrarPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                                    >
                                        <i className={`bi ${mostrarPassword ? "bi-eye-slash" : "bi-eye"}`}></i>
                                    </button>
                                </div>
                            </div>

                            <div className="adomi-login__field">
                                <label htmlFor="confirmarPassword">Confirmar contraseña</label>
                                <div className="adomi-login__input">
                                    <i className="bi bi-shield-check"></i>
                                    <input
                                        id="confirmarPassword"
                                        type={mostrarPassword ? "text" : "password"}
                                        autoComplete="new-password"
                                        placeholder="Repite la contraseña"
                                        minLength="8"
                                        maxLength="72"
                                        value={confirmarPassword}
                                        onChange={(e) => setConfirmarPassword(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="adomi-login__submit"
                                disabled={cargando}
                            >
                                {cargando ? (
                                    <>
                                        <span className="spinner-border spinner-border-sm" aria-hidden="true"></span>
                                        Actualizando...
                                    </>
                                ) : (
                                    <>
                                        Guardar nueva contraseña
                                        <i className="bi bi-check-lg"></i>
                                    </>
                                )}
                            </button>
                        </form>
                    ) : null}

                    <div className="adomi-login__register">
                        <button
                            type="button"
                            onClick={() => (window.location.href = "/")}
                        >
                            <i className="bi bi-arrow-left me-2"></i>
                            Volver al inicio de sesión
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

export default ResetPassword;
