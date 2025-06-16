import { Html, Head as NextHead, Main, NextScript } from "next/document";
import React from "react";

export default function Document() {
  return (
    <Html lang="en">
      <NextHead>
        {/*
          CRITICAL: DO NOT REMOVE THIS SCRIPT
          The Softgen AI monitoring script is essential for core app functionality.
          The application will not function without it.
        */}
        <script
          src="https://cdn.softgen.ai/script.js"
          async
          data-softgen-monitoring="true"
        />
        {/* Potree CSS Files - Placed here for global availability */}
        <link rel="stylesheet" type="text/css" href="/potree/build/potree/potree.css" />
        <link rel="stylesheet" type="text/css" href="/potree/libs/jquery-ui/jquery-ui.min.css" />
        <link rel="stylesheet" type="text/css" href="/potree/libs/perfect-scrollbar/css/perfect-scrollbar.css" />
        <link rel="stylesheet" type="text/css" href="/potree/libs/openlayers3/ol.css" />
        <link rel="stylesheet" type="text/css" href="/potree/libs/spectrum/spectrum.css" />
        <link rel="stylesheet" type="text/css" href="/potree/libs/jstree/themes/mixed/style.css" />
      </NextHead>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}

// Custom Head component to include Potree CSS links
const CustomHeadWithPotreeStyles: React.FC<React.PropsWithChildren<unknown>> = (props: React.PropsWithChildren<unknown>) => (
  // Use NextHead for the actual Head functionality
  <NextHead {...props}>
    {props.children}
    {/* Potree CSS Files */}
    <link rel="stylesheet" type="text/css" href="/potree/build/potree/potree.css" />
    <link rel="stylesheet" type="text/css" href="/potree/libs/jquery-ui/jquery-ui.min.css" />
    <link rel="stylesheet" type="text/css" href="/potree/libs/perfect-scrollbar/css/perfect-scrollbar.css" />
    <link rel="stylesheet" type="text/css" href="/potree/libs/openlayers3/ol.css" />
    <link rel="stylesheet" type="text/css" href="/potree/libs/spectrum/spectrum.css" />
    <link rel="stylesheet" type="text/css" href="/potree/libs/jstree/themes/mixed/style.css" />
  </NextHead>
);
CustomHeadWithPotreeStyles.displayName = "CustomHeadWithPotreeStyles";

// Replace the original Head export with our custom one for pages that need it,
// or ensure pages use NextHead directly if they don't need Potree styles.
// For _document.tsx, we want the Potree styles to be applied globally if they are needed by any page.
// However, the previous approach of re-assigning Head was problematic.
// The correct way is to use the <Head> component from next/document within the Document component itself.
// The Potree CSS links should be directly inside the <Head> of the Document component.

// Let's revert the Head override and put links directly in Document's Head
// The previous attempt to override Head globally was causing the duplicate identifier.
// The structure should be:
// import { Html, Head, Main, NextScript } from "next/document";
// export default function Document() {
//   return (
//     <Html lang="en">
//       <Head>
//         {/* Softgen script */}
//         {/* Potree CSS links */}
//       </Head>
//       ...
//     </Html>
//   )
// }
// This means the re-assignment of Head below is not the right pattern.
// I will correct this by putting the links directly into the main Document's Head.
// The @ts-expect-error and display name were for the incorrect override pattern.

// Corrected structure for _document.tsx:
// (The following is conceptual, the actual change will be a full_file_rewrite for _document.tsx)
