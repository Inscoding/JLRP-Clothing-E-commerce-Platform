// src/components/Footer.tsx
export default function Footer() {
  return (
    <footer className="w-full border-t mt-8 bg-gray-50">
      <div className="container mx-auto px-4 py-4 text-sm text-gray-600 text-center">
        © {new Date().getFullYear()} JLRP Brand — Built with ❤️ by the JLRP Team
      </div>
    </footer>
  );
}
