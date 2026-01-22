import React from "react";
import CartPage from "@/pages/CartPage";

const StaffCartPage: React.FC = () => {
  // CartPage already adapts its internal navigation based on the current pathname
  // (it detects /funcionario and uses /funcionario/* paths).
  return <CartPage />;
};

export default StaffCartPage;
