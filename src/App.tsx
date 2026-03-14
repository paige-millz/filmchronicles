import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Gallery from "./pages/Gallery";
import Upload from "./pages/Upload";
import EditPhoto from "./pages/EditPhoto";
import PhotoDetail from "./pages/PhotoDetail";
import SharePhoto from "./pages/SharePhoto";
import Auth from "./pages/Auth";
import UpdateOrientations from "./pages/UpdateOrientations";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<Gallery />} />
            <Route path="/upload" element={<Upload />} />
            <Route path="/edit/:id" element={<EditPhoto />} />
            <Route path="/photo/:id" element={<PhotoDetail />} />
            <Route path="/share/:id" element={<SharePhoto />} />
            <Route path="/update-orientations" element={<UpdateOrientations />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
