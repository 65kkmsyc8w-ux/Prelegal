"use client";

import { useState } from "react";

import { AuthGate } from "@/components/AuthGate";
import { NdaDocument } from "@/components/NdaDocument";
import { NdaForm } from "@/components/NdaForm";
import { emptyNda } from "@/lib/nda";

export const Home = () => {
  const [details, setDetails] = useState(emptyNda);

  return (
    <main className="page">
      <header className="masthead">
        <h1>Mutual NDA creator</h1>
        <p>
          Fill in the cover page and the agreement builds as you type. Anything left
          blank shows as a placeholder in square brackets.
        </p>
      </header>

      <div className="columns">
        <div className="column form-column">
          <NdaForm
            details={details}
            onChange={setDetails}
            onDownload={() => window.print()}
          />
        </div>
        <div className="column document-column">
          <NdaDocument details={details} />
        </div>
      </div>
    </main>
  );
};

const Page = () => (
  <AuthGate>
    <Home />
  </AuthGate>
);

export default Page;
