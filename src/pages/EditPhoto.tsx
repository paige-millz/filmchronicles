import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const EditPhoto = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formData, setFormData] = useState({
    aperture: "",
    shutter_speed: "",
    iso: "",
    camera: "",
    recipe: "",
    capture_time: "",
    shoot_type: "",
  });

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    fetchPhoto();
  }, [id, user, navigate]);

  const fetchPhoto = async () => {
    try {
      const { data, error } = await supabase
        .from("photos")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;

      setFormData({
        aperture: data.aperture || "",
        shutter_speed: data.shutter_speed || "",
        iso: data.iso?.toString() || "",
        camera: data.camera || "",
        recipe: data.recipe || "",
        capture_time: data.capture_time
          ? new Date(data.capture_time).toISOString().slice(0, 16)
          : "",
        shoot_type: data.shoot_type || "",
      });
    } catch (error) {
      console.error("Error fetching photo:", error);
      toast({
        title: "Error loading photo",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const { error } = await supabase
        .from("photos")
        .update({
          aperture: formData.aperture || null,
          shutter_speed: formData.shutter_speed || null,
          iso: formData.iso ? parseInt(formData.iso) : null,
          camera: formData.camera || null,
          recipe: formData.recipe || null,
          capture_time: formData.capture_time || null,
          shoot_type: formData.shoot_type || null,
        })
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Photo updated",
        description: "Metadata saved successfully",
      });

      navigate(`/photo/${id}`);
    } catch (error) {
      console.error("Error updating photo:", error);
      toast({
        title: "Error saving changes",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const { error } = await supabase
        .from("photos")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Photo deleted",
        description: "Photo removed from your journal",
      });

      navigate("/");
    } catch (error) {
      console.error("Error deleting photo:", error);
      toast({
        title: "Error deleting photo",
        variant: "destructive",
      });
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <Link
            to={`/photo/${id}`}
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Photo
          </Link>
          <h1 className="text-3xl font-bold">Edit Metadata</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="aperture">Aperture</Label>
            <Input
              id="aperture"
              placeholder="e.g., f/2.8"
              value={formData.aperture}
              onChange={e => setFormData({ ...formData, aperture: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="shutter_speed">Shutter Speed</Label>
            <Input
              id="shutter_speed"
              placeholder="e.g., 1/125"
              value={formData.shutter_speed}
              onChange={e => setFormData({ ...formData, shutter_speed: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="iso">ISO</Label>
            <Input
              id="iso"
              type="number"
              placeholder="e.g., 400"
              value={formData.iso}
              onChange={e => setFormData({ ...formData, iso: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="camera">Camera</Label>
            <Input
              id="camera"
              placeholder="e.g., X-T4"
              value={formData.camera}
              onChange={e => setFormData({ ...formData, camera: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="recipe">Film Recipe</Label>
            <Input
              id="recipe"
              placeholder="e.g., Classic Chrome"
              value={formData.recipe}
              onChange={e => setFormData({ ...formData, recipe: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="capture_time">Capture Date/Time</Label>
            <Input
              id="capture_time"
              type="datetime-local"
              value={formData.capture_time}
              onChange={e => setFormData({ ...formData, capture_time: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="shoot_type">Shoot Type</Label>
            <Input
              id="shoot_type"
              placeholder="e.g., street, landscape, portraits, or type custom"
              value={formData.shoot_type}
              onChange={e => setFormData({ ...formData, shoot_type: e.target.value })}
              list="shoot-type-suggestions"
            />
            <datalist id="shoot-type-suggestions">
              <option value="street" />
              <option value="christmas" />
              <option value="landscape" />
              <option value="portraits" />
              <option value="travel" />
              <option value="other" />
            </datalist>
          </div>

          <div className="flex gap-4">
            <Button type="submit" disabled={saving || deleting} className="flex-1">
              <Save className="w-4 h-4 mr-2" />
              {saving ? "Saving..." : "Save Changes"}
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  type="button" 
                  variant="destructive" 
                  disabled={saving || deleting}
                  className="flex-1"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {deleting ? "Deleting..." : "Delete Photo"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete this photo from your journal. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditPhoto;
