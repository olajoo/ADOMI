import { BrowserRouter, Routes, Route } from "react-router-dom";

import Login from "./pages/Login";
import Register from "./pages/Register";
import ResetPassword from "./pages/ResetPassword";
import AdminDashboard from "./pages/AdminDashboard";
import ClienteDashboard from "./pages/ClienteDashboard";
import RepartidorDashboard from "./pages/RepartidorDashboard";

import ProtectedRoute from "./routes/ProtectedRoute";

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Login />} />
                <Route path="/registro" element={<Register />} />
                <Route path="/reset-password" element={<ResetPassword />} />

                <Route
                    path="/admin"
                    element={
                        <ProtectedRoute allowedRole="admin">
                            <AdminDashboard />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/cliente"
                    element={
                        <ProtectedRoute allowedRole="cliente">
                            <ClienteDashboard />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/repartidor"
                    element={
                        <ProtectedRoute allowedRole="repartidor">
                            <RepartidorDashboard />
                        </ProtectedRoute>
                    }
                />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
