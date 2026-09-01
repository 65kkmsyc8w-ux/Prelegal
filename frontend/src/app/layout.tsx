import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Prelegal",
  description: "Draft common legal agreements by talking to an assistant.",
};

const RootLayout = ({ children }: LayoutProps<"/">) => (
  <html lang="en">
    <body>{children}</body>
  </html>
);

export default RootLayout;
