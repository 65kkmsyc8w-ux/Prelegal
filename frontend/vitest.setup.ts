import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

import "@testing-library/jest-dom/vitest";

// Testing Library registers its own cleanup only when vitest runs with globals.
afterEach(cleanup);
