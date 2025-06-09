import "@/styles/globals.css";
import "@/styles/potree-viewer.css";
import type { AppProps } from "next/app";

export default function App({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}
