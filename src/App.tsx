import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CartProvider } from "@/contexts/CartContext";
import { StoreProvider } from "@/contexts/StoreContext";
import { AdminProvider } from "@/contexts/AdminContext";
import { StaffProvider } from "@/contexts/StaffContext";
import { DeliveryProvider } from "@/contexts/DeliveryContext";

// Public Pages
import { PublicLayout } from "@/components/public/PublicLayout";
import HomePage from "@/pages/HomePage";
import MenuPage from "@/pages/MenuPage";
import CartPage from "@/pages/CartPage";
import CheckoutPage from "@/pages/CheckoutPage";
import PaymentPage from "@/pages/PaymentPage";
import OrderTrackingPage from "@/pages/OrderTrackingPage";
import TrackOrderPage from "@/pages/TrackOrderPage";
import InstallPage from "@/pages/InstallPage";
// Admin Pages
import AdminLoginPage from "@/pages/admin/AdminLoginPage";
import AdminLayout from "@/pages/admin/AdminLayout";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminOrders from "@/pages/admin/AdminOrders";
import AdminProducts from "@/pages/admin/AdminProducts";
import AdminSettings from "@/pages/admin/AdminSettings";
import AdminStaff from "@/pages/admin/AdminStaff";
import AdminDeliverers from "@/pages/admin/AdminDeliverers";
import AdminUsers from "@/pages/admin/AdminUsers";

// Staff Pages
import StaffLoginPage from "@/pages/staff/StaffLoginPage";
import StaffLayout from "@/pages/staff/StaffLayout";
import StaffOrdersPage from "@/pages/staff/StaffOrdersPage";
import StaffCartPage from "@/pages/staff/StaffCartPage";
import StaffCheckoutPage from "@/pages/staff/StaffCheckoutPage";

// Delivery Pages
import DeliveryLayout from "@/pages/delivery/DeliveryLayout";
import DeliveryLoginPage from "@/pages/delivery/DeliveryLoginPage";
import DeliveryOrdersPage from "@/pages/delivery/DeliveryOrdersPage";

import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <StoreProvider>
        <CartProvider>
          <AdminProvider>
            <StaffProvider>
              <DeliveryProvider>
                <Toaster />
                <Sonner />
                <BrowserRouter>
                  <Routes>
                {/* Public Routes - No Login Required */}
                <Route element={<PublicLayout />}>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/cardapio" element={<MenuPage />} />
                  <Route path="/carrinho" element={<CartPage />} />
                  <Route path="/checkout" element={<CheckoutPage />} />
                  <Route path="/pagamento" element={<PaymentPage />} />
                  <Route path="/install" element={<InstallPage />} />
                  <Route path="/acompanhar" element={<TrackOrderPage />} />
                  <Route path="/pedido/:orderId" element={<OrderTrackingPage />} />
                </Route>

                {/* Admin Routes */}
                <Route path="/admin" element={<AdminLoginPage />} />
                <Route path="/admin" element={<AdminLayout />}>
                  <Route path="dashboard" element={<AdminDashboard />} />
                  <Route path="pedidos" element={<AdminOrders />} />
                  <Route path="produtos" element={<AdminProducts />} />
                  <Route path="usuarios" element={<AdminUsers />} />
                  {/* Rotas antigas mantidas por compatibilidade */}
                  <Route path="funcionarios" element={<AdminStaff />} />
                  <Route path="entregadores" element={<AdminDeliverers />} />
                  <Route path="configuracoes" element={<AdminSettings />} />
                </Route>

                  {/* Staff Routes */}
                  <Route path="/funcionario" element={<StaffLayout />}>
                    <Route index element={<StaffLoginPage />} />
                    <Route path="pedidos" element={<StaffOrdersPage />} />
                    <Route path="carrinho" element={<StaffCartPage />} />
                    <Route path="checkout" element={<StaffCheckoutPage />} />
                  </Route>

                  {/* Deliverer Routes */}
                  <Route path="/entregador" element={<DeliveryLayout />}>
                    <Route index element={<DeliveryLoginPage />} />
                    <Route path="pedidos" element={<DeliveryOrdersPage />} />
                  </Route>

                {/* 404 */}
                <Route path="*" element={<NotFound />} />
                  </Routes>
                </BrowserRouter>
              </DeliveryProvider>
            </StaffProvider>
          </AdminProvider>
        </CartProvider>
      </StoreProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
