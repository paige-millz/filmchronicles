import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Upload as UploadIcon, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import exifr from "exifr";

const Upload = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }

    const checkAdminStatus = async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .single();

      if (error || !data) {
        toast({
          title: "Access Denied",
          description: "You don't have permission to upload photos",
          variant: "destructive",
        });
        navigate("/");
      } else {
        setIsAdmin(true);
      }
      setLoading(false);
    };

    checkAdminStatus();
  }, [user, navigate, toast]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const getImageOrientation = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const width = img.naturalWidth;
        const height = img.naturalHeight;
        
        if (height > width) {
          resolve('portrait');
        } else if (height === width) {
          resolve('square');
        } else {
          resolve('landscape');
        }
        URL.revokeObjectURL(img.src);
      };
      img.onerror = () => {
        resolve('landscape'); // fallback
      };
      img.src = URL.createObjectURL(file);
    });
  };

  const generateThumbnail = async (file: File, maxWidth: number = 800): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ratio = maxWidth / img.naturalWidth;
        // If image is already smaller than maxWidth, don't upscale
        const scale = ratio < 1 ? ratio : 1;
        canvas.width = img.naturalWidth * scale;
        canvas.height = img.naturalHeight * scale;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to create thumbnail'));
            }
          },
          'image/jpeg',
          0.92 // 92% quality for sharp thumbnails
        );
        URL.revokeObjectURL(img.src);
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  };

  const uploadFiles = async (filesToUpload: File[]) => {
    if (filesToUpload.length === 0) return;

    setUploading(true);
    setFiles(filesToUpload);
    let successCount = 0;
    let errorCount = 0;

    for (const file of filesToUpload) {
      try {
        // Check for existing photo with same filename
        const { data: existing } = await supabase
          .from("photos")
          .select("id")
          .eq("original_filename", file.name)
          .maybeSingle();

        if (existing) {
          toast({
            title: "Skipped duplicate",
            description: `"${file.name}" already exists`,
          });
          continue;
        }

        // Upload original to storage
        const fileName = `${Date.now()}_${file.name}`;
        const { data: storageData, error: storageError } = await supabase.storage
          .from("photo-uploads")
          .upload(fileName, file);

        if (storageError) {
          console.error("Storage error:", storageError);
          errorCount++;
          continue;
        }

        // Get public URL for original
        const { data: urlData } = supabase.storage
          .from("photo-uploads")
          .getPublicUrl(fileName);

        // Generate and upload thumbnail
        const thumbnailBlob = await generateThumbnail(file);
        const thumbFileName = `thumb_${fileName}`;
        const { error: thumbError } = await supabase.storage
          .from("photo-uploads")
          .upload(thumbFileName, thumbnailBlob);

        let thumbUrl = urlData.publicUrl; // Fallback to original if thumbnail upload fails
        
        if (!thumbError) {
          const { data: thumbUrlData } = supabase.storage
            .from("photo-uploads")
            .getPublicUrl(thumbFileName);
          thumbUrl = thumbUrlData.publicUrl;
        } else {
          console.error("Thumbnail upload error:", thumbError);
        }

        // Get orientation from image dimensions
        const orientation = await getImageOrientation(file);

        // Extract EXIF
        const exifData = await extractExifData(file);

        console.log("Uploading with data:", {
          original_filename: file.name,
          file_url: urlData.publicUrl,
          thumb_url: thumbUrl,
          orientation,
          ...exifData,
        });

        // Upsert to database
        const { error: dbError } = await supabase
          .from("photos")
          .upsert(
            {
              original_filename: file.name,
              file_url: urlData.publicUrl,
              thumb_url: thumbUrl,
              aperture: exifData.aperture,
              shutter_speed: exifData.shutter_speed,
              iso: exifData.iso,
              camera: exifData.camera,
              recipe: exifData.recipe,
              capture_time: exifData.capture_time,
              orientation: orientation,
              owner_id: user?.id,
            },
            { onConflict: "original_filename" }
          );

        if (dbError) {
          console.error("Database error:", dbError);
          errorCount++;
        } else {
          successCount++;
        }
      } catch (error) {
        console.error("Upload error:", error);
        errorCount++;
      }
    }

    setUploading(false);
    setFiles([]);

    if (successCount > 0) {
      toast({
        title: "Upload complete",
        description: `${successCount} photo(s) uploaded successfully${errorCount > 0 ? `, ${errorCount} failed` : ""}`,
      });
    } else {
      toast({
        title: "Upload failed",
        description: "All uploads failed. Check console for details.",
        variant: "destructive",
      });
    }
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const droppedFiles = Array.from(e.dataTransfer.files).filter(file =>
      file.type.startsWith("image/")
    );
    
    if (droppedFiles.length > 0) {
      await uploadFiles(droppedFiles);
    }
  }, [user]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files).filter(file =>
        file.type.startsWith("image/")
      );
      
      if (selectedFiles.length > 0) {
        await uploadFiles(selectedFiles);
      }
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  };


  const extractExifData = async (file: File) => {
    try {
      const exif = await exifr.parse(file, {
        pick: [
          "FNumber",
          "ExposureTime",
          "ISO",
          "Model",
          "FilmMode",
          "DateTimeOriginal",
          "CreateDate",
        ],
      });

      console.log("EXIF data:", exif);

      return {
        aperture: exif?.FNumber ? `f/${exif.FNumber}` : null,
        shutter_speed: exif?.ExposureTime
          ? exif.ExposureTime < 1
            ? `1/${Math.round(1 / exif.ExposureTime)}`
            : `${exif.ExposureTime}s`
          : null,
        iso: exif?.ISO || null,
        camera: exif?.Model || null,
        recipe: exif?.FilmMode || null,
        capture_time: exif?.DateTimeOriginal || exif?.CreateDate || null,
      };
    } catch (error) {
      console.error("Error extracting EXIF:", error);
      return {
        aperture: null,
        shutter_speed: null,
        iso: null,
        camera: null,
        recipe: null,
        capture_time: null,
      };
    }
  };


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" />
            Back to Gallery
          </Link>
          <h1 className="text-3xl font-bold">Upload Photos</h1>
        </div>

        <div
          className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
            dragActive ? "border-primary bg-primary/5" : "border-border"
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <UploadIcon className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <p className="text-lg mb-4">Drag and drop photos here</p>
          <p className="text-muted-foreground mb-4">or</p>
          <label>
            <Button type="button" variant="outline" asChild>
              <span>
                Choose Files
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </span>
            </Button>
          </label>
        </div>

        {uploading && files.length > 0 && (
          <div className="mt-8 space-y-4">
            <h2 className="text-xl font-semibold">Uploading {files.length} photo{files.length !== 1 ? 's' : ''}...</h2>
            <div className="space-y-2">
              {files.map((file, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-card rounded-lg">
                  <span className="text-sm truncate flex-1">{file.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Upload;
