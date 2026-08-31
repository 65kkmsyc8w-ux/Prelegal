import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Mutual NDA",
  description: "Create a Common Paper Mutual Non-Disclosure Agreement.",
};

const RootLayout = ({ children }: LayoutProps<"/">) => (
  <html lang="en">
    <body>{children}</body>
  </html>
);

export default RootLayout;
