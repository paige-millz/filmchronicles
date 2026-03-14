import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LazyPhotoCard } from "@/components/LazyPhotoCard";
import { PhotoCardSkeleton } from "@/components/PhotoCardSkeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, CheckSquare, X, LogOut, Trash2, Calendar as CalendarIcon, Grid3x3, List, LayoutDashboard, Sparkles, Loader2, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import footerLogo from "@/assets/film-chronicles-footer-logo.png";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
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

interface Photo {
  id: string;
  file_url: string;
  thumb_url: string | null;
  original_filename: string;
  aperture: string | null;
  shutter_speed: string | null;
  iso: number | null;
  camera: string | null;
  recipe: string | null;
  capture_time: string | null;
  orientation: string | null;
  shoot_type: string | null;
  tags: string[] | null;
}

const Gallery = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [filteredPhotos, setFilteredPhotos] = useState<Photo[]>([]);
  const [cameras, setCameras] = useState<string[]>([]);
  const [recipes, setRecipes] = useState<string[]>([]);
  const [shootTypes, setShootTypes] = useState<string[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>("all");
  const [selectedRecipe, setSelectedRecipe] = useState<string>("all");
  const [selectedShootType, setSelectedShootType] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });
  const [viewMode, setViewMode] = useState<"grid" | "list" | "masonry">("grid");
  const [loading, setLoading] = useState(true);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [batchRecipe, setBatchRecipe] = useState<string>("");
  const [batchShootType, setBatchShootType] = useState<string>("");
  const [displayName, setDisplayName] = useState<string>("");
  const [deleting, setDeleting] = useState(false);
  const [aiOrganizing, setAiOrganizing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string>("all");
  const [allTags, setAllTags] = useState<string[]>([]);
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [userLikes, setUserLikes] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  useEffect(() => {
    if (!user) {
      navigate("/auth");
    } else {
      fetchUserProfile();
    }
  }, [user, navigate]);

  useEffect(() => {
    fetchPhotos();
  }, []);

  // Restore scroll position on mount
  useEffect(() => {
    const savedScrollPosition = sessionStorage.getItem('galleryScrollPosition');
    if (savedScrollPosition) {
      window.scrollTo(0, parseInt(savedScrollPosition));
      sessionStorage.removeItem('galleryScrollPosition');
    }
  }, []);

  // Save scroll position on unmount
  useEffect(() => {
    return () => {
      sessionStorage.setItem('galleryScrollPosition', window.scrollY.toString());
    };
  }, []);

  const fetchUserProfile = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .single();

      if (error) throw error;
      setDisplayName(data?.display_name || "");
    } catch (error) {
      console.error("Error fetching profile:", error);
    }
  };

  useEffect(() => {
    filterPhotos();
  }, [selectedCamera, selectedRecipe, selectedShootType, selectedTag, sortOrder, dateRange, photos]);

  const fetchPhotos = async () => {
    try {
      const { data, error } = await supabase
        .from("photos")
        .select("*")
        .order("capture_time", { ascending: false })
        .limit(100); // Load first 100 photos for better performance

      if (error) throw error;

      setPhotos(data || []);

      // Extract unique cameras, recipes, and shoot types
      const uniqueCameras = [...new Set((data || []).map(p => p.camera).filter(Boolean))];
      const uniqueRecipes = [...new Set((data || []).map(p => p.recipe).filter(Boolean))];
      const uniqueShootTypes = [...new Set((data || []).map(p => p.shoot_type).filter(Boolean))];
      const uniqueTags = [...new Set((data || []).flatMap(p => p.tags || []).filter(Boolean))].sort();
      
      setCameras(uniqueCameras as string[]);
      setRecipes(uniqueRecipes as string[]);
      setShootTypes(uniqueShootTypes as string[]);
      setAllTags(uniqueTags);

      // Fetch all like counts and user likes in parallel
      if (data && data.length > 0 && user) {
        const photoIds = data.map(p => p.id);
        
        // Parallelize API calls for better performance
        const [allLikesResult, userLikesResult] = await Promise.all([
          supabase
            .from("photo_likes")
            .select("photo_id")
            .in("photo_id", photoIds),
          supabase
            .from("photo_likes")
            .select("photo_id")
            .in("photo_id", photoIds)
            .eq("user_id", user.id)
        ]);

        // Process like counts
        const counts: Record<string, number> = {};
        allLikesResult.data?.forEach(like => {
          counts[like.photo_id] = (counts[like.photo_id] || 0) + 1;
        });
        setLikeCounts(counts);

        // Process user likes
        setUserLikes(new Set(userLikesResult.data?.map(l => l.photo_id) || []));
      }
    } catch (error) {
      console.error("Error fetching photos:", error);
    } finally {
      setLoading(false);
    }
  };

  const filterPhotos = () => {
    let filtered = [...photos];

    if (selectedCamera !== "all") {
      filtered = filtered.filter(p => p.camera === selectedCamera);
    }

    if (selectedRecipe !== "all") {
      filtered = filtered.filter(p => p.recipe === selectedRecipe);
    }

    if (selectedShootType !== "all") {
      filtered = filtered.filter(p => p.shoot_type === selectedShootType);
    }

    if (selectedTag !== "all") {
      filtered = filtered.filter(p => p.tags && p.tags.includes(selectedTag));
    }

    // Filter by date range
    if (dateRange.from || dateRange.to) {
      filtered = filtered.filter(p => {
        if (!p.capture_time) return false;
        const photoDate = new Date(p.capture_time);
        if (dateRange.from && photoDate < dateRange.from) return false;
        if (dateRange.to) {
          const endOfDay = new Date(dateRange.to);
          endOfDay.setHours(23, 59, 59, 999);
          if (photoDate > endOfDay) return false;
        }
        return true;
      });
    }

    // Sort by capture_time
    filtered.sort((a, b) => {
      const timeA = a.capture_time ? new Date(a.capture_time).getTime() : 0;
      const timeB = b.capture_time ? new Date(b.capture_time).getTime() : 0;
      return sortOrder === "asc" ? timeA - timeB : timeB - timeA;
    });

    setFilteredPhotos(filtered);
  };

  const handleSelectionChange = (photoId: string, selected: boolean) => {
    setSelectedPhotos(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(photoId);
      } else {
        newSet.delete(photoId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    const allPhotoIds = new Set(filteredPhotos.map(p => p.id));
    setSelectedPhotos(allPhotoIds);
  };

  const applyBatchRecipe = async () => {
    if (!batchRecipe || selectedPhotos.size === 0) return;

    try {
      const { error } = await supabase
        .from("photos")
        .update({ recipe: batchRecipe })
        .in("id", Array.from(selectedPhotos));

      if (error) throw error;

      toast({
        title: "Recipe applied",
        description: `Updated ${selectedPhotos.size} photo(s)`,
      });

      // Refresh photos
      await fetchPhotos();
      setSelectedPhotos(new Set());
      setSelectionMode(false);
      setBatchRecipe("");
    } catch (error) {
      console.error("Error updating photos:", error);
      toast({
        title: "Error",
        description: "Failed to apply recipe",
        variant: "destructive",
      });
    }
  };

  const applyBatchShootType = async () => {
    if (!batchShootType || selectedPhotos.size === 0) return;

    try {
      const { error } = await supabase
        .from("photos")
        .update({ shoot_type: batchShootType })
        .in("id", Array.from(selectedPhotos));

      if (error) throw error;

      toast({
        title: "Shoot type applied",
        description: `Updated ${selectedPhotos.size} photo(s)`,
      });

      // Refresh photos
      await fetchPhotos();
      setSelectedPhotos(new Set());
      setSelectionMode(false);
      setBatchShootType("");
    } catch (error) {
      console.error("Error updating photos:", error);
      toast({
        title: "Error",
        description: "Failed to apply shoot type",
        variant: "destructive",
      });
    }
  };

  const handleBatchDelete = async () => {
    if (selectedPhotos.size === 0) return;

    setDeleting(true);
    try {
      const { error } = await supabase
        .from("photos")
        .delete()
        .in("id", Array.from(selectedPhotos));

      if (error) throw error;

      toast({
        title: "Photos deleted",
        description: `Removed ${selectedPhotos.size} photo(s) from your journal`,
      });

      await fetchPhotos();
      setSelectedPhotos(new Set());
      setSelectionMode(false);
    } catch (error) {
      console.error("Error deleting photos:", error);
      toast({
        title: "Error deleting photos",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleDownloadAll = async () => {
    const photosToDownload = selectionMode && selectedPhotos.size > 0
      ? filteredPhotos.filter(p => selectedPhotos.has(p.id))
      : filteredPhotos;

    if (photosToDownload.length === 0) return;

    setDownloading(true);
    toast({
      title: "Downloading...",
      description: `Preparing ${photosToDownload.length} photo(s) for download`,
    });

    let successCount = 0;
    for (const photo of photosToDownload) {
      try {
        const response = await fetch(photo.file_url);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = photo.original_filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        successCount++;
        // Small delay between downloads to avoid browser blocking
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error) {
        console.error(`Error downloading ${photo.original_filename}:`, error);
      }
    }

    setDownloading(false);
    toast({
      title: "Download complete",
      description: `Downloaded ${successCount} of ${photosToDownload.length} photo(s)`,
    });
  };

  const handleAiOrganize = async (photoIds?: string[]) => {
    const ids = photoIds || (selectedPhotos.size > 0 ? Array.from(selectedPhotos) : filteredPhotos.map(p => p.id));
    if (ids.length === 0) return;

    setAiOrganizing(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-organize", {
        body: { photo_ids: ids },
      });

      if (error) throw error;

      if (data?.error) {
        toast({
          title: "AI Organize Error",
          description: data.error,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "AI Organize Complete",
        description: `Successfully analyzed ${data.updated} photo(s) — shoot types, recipes, and tags updated!`,
      });

      await fetchPhotos();
      setSelectedPhotos(new Set());
      setSelectionMode(false);
    } catch (error: any) {
      console.error("Error with AI organize:", error);
      toast({
        title: "AI Organize Failed",
        description: error?.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setAiOrganizing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Film Chronicles</h1>
            <p className="text-muted-foreground mt-1">Loading your photo chronicles...</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <PhotoCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Film Chronicles</h1>
            <p className="text-muted-foreground mt-1">hey fam! Happy you are here to view Paige's photo chronicles.</p>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant={viewMode === "grid" ? "secondary" : "outline"}
              onClick={() => setViewMode("grid")}
              size="icon"
              className="hidden sm:inline-flex"
            >
              <Grid3x3 className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === "masonry" ? "secondary" : "outline"}
              onClick={() => setViewMode("masonry")}
              size="icon"
              className="hidden sm:inline-flex"
              title="Masonry layout"
            >
              <LayoutDashboard className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "outline"}
              onClick={() => setViewMode("list")}
              size="icon"
              className="hidden sm:inline-flex"
            >
              <List className="w-4 h-4" />
            </Button>
            <Button
              variant={selectionMode ? "secondary" : "outline"}
              onClick={() => {
                setSelectionMode(!selectionMode);
                setSelectedPhotos(new Set());
              }}
              className="gap-2"
            >
              <CheckSquare className="w-4 h-4" />
              {selectionMode ? "Cancel" : "Select"}
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={handleDownloadAll}
              disabled={downloading}
            >
              {downloading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {downloading ? "Downloading..." : "Export All"}
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => handleAiOrganize()}
              disabled={aiOrganizing}
            >
              {aiOrganizing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {aiOrganizing ? "Analyzing..." : "AI Organize"}
            </Button>
            <Link to="/upload">
              <Button className="gap-2">
                <Upload className="w-4 h-4" />
                Upload
              </Button>
            </Link>
            <Button
              variant="ghost"
              className="gap-2"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate("/auth");
              }}
            >
              <LogOut className="w-4 h-4" />
              Logout
            </Button>
          </div>
        </div>

        {selectionMode && (
          <div className="sticky top-0 z-40 mb-6 p-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border border-border rounded-lg shadow-md">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-3">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={selectedPhotos.size === filteredPhotos.length && filteredPhotos.length > 0}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        handleSelectAll();
                      } else {
                        setSelectedPhotos(new Set());
                      }
                    }}
                  />
                  <span className="text-sm font-medium">Select All</span>
                </label>
                <span className="text-sm text-muted-foreground">
                  {selectedPhotos.size} photo(s) selected
                </span>
              </div>
            </div>
            
            {selectedPhotos.size > 0 && (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                  <Input
                    placeholder="Enter recipe name..."
                    value={batchRecipe}
                    onChange={(e) => setBatchRecipe(e.target.value)}
                    className="w-full sm:w-[200px]"
                  />
                  <Button onClick={applyBatchRecipe} disabled={!batchRecipe || deleting}>
                    Apply Recipe
                  </Button>
                </div>
                
                <div className="flex flex-col gap-2">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                    <Select value={batchShootType} onValueChange={setBatchShootType}>
                      <SelectTrigger className="w-full sm:w-[200px]">
                        <SelectValue placeholder="Select shoot type..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="street">Street</SelectItem>
                        <SelectItem value="christmas">Christmas</SelectItem>
                        <SelectItem value="landscape">Landscape</SelectItem>
                        <SelectItem value="portraits">Portraits</SelectItem>
                        <SelectItem value="travel">Travel</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                        {shootTypes.filter(st => !["street", "christmas", "landscape", "portraits", "travel", "other"].includes(st)).map(shootType => (
                          <SelectItem key={shootType} value={shootType}>{shootType}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-sm text-muted-foreground">or</span>
                    <Input
                      placeholder="Type custom shoot type..."
                      value={batchShootType}
                      onChange={(e) => setBatchShootType(e.target.value)}
                      className="w-full sm:w-[200px]"
                    />
                    <Button onClick={applyBatchShootType} disabled={!batchShootType || deleting}>
                      Apply Shoot Type
                    </Button>
                  </div>
                </div>
                
                <Button
                  onClick={() => handleAiOrganize()}
                  disabled={aiOrganizing || deleting}
                  className="gap-2"
                >
                  {aiOrganizing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  {aiOrganizing ? "Analyzing..." : "AI Organize"}
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={deleting || aiOrganizing}>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete {selectedPhotos.size} photo(s) from your journal. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleBatchDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedPhotos(new Set())}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        )}

        <div className="mb-8 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
            <Select value={selectedCamera} onValueChange={setSelectedCamera}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="All Cameras" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cameras</SelectItem>
                {cameras.map(camera => (
                  <SelectItem key={camera} value={camera}>{camera}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedRecipe} onValueChange={setSelectedRecipe}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="All Recipes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Recipes</SelectItem>
                {recipes.map(recipe => (
                  <SelectItem key={recipe} value={recipe}>{recipe}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedShootType} onValueChange={setSelectedShootType}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="All Shoot Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Shoot Types</SelectItem>
                <SelectItem value="street">Street</SelectItem>
                <SelectItem value="christmas">Christmas</SelectItem>
                <SelectItem value="landscape">Landscape</SelectItem>
                <SelectItem value="portraits">Portraits</SelectItem>
                <SelectItem value="travel">Travel</SelectItem>
                <SelectItem value="other">Other</SelectItem>
                {shootTypes.filter(st => !["street", "christmas", "landscape", "portraits", "travel", "other"].includes(st)).map(shootType => (
                  <SelectItem key={shootType} value={shootType}>{shootType}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full sm:w-[280px] justify-start text-left font-normal",
                    !dateRange.from && !dateRange.to && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "MMM d, yyyy")} - {format(dateRange.to, "MMM d, yyyy")}
                      </>
                    ) : (
                      format(dateRange.from, "MMM d, yyyy")
                    )
                  ) : (
                    <span>Pick date range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={{ from: dateRange.from, to: dateRange.to }}
                  onSelect={(range) => setDateRange({ from: range?.from, to: range?.to })}
                  numberOfMonths={2}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>

            <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as "asc" | "desc")}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">Newest First</SelectItem>
                <SelectItem value="asc">Oldest First</SelectItem>
              </SelectContent>
            </Select>

            {allTags.length > 0 && (
              <Select value={selectedTag} onValueChange={setSelectedTag}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="All Tags" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tags</SelectItem>
                  {allTags.map(tag => (
                    <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {(selectedCamera !== "all" || selectedRecipe !== "all" || selectedShootType !== "all" || selectedTag !== "all" || dateRange.from || dateRange.to) && (
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedCamera("all");
                  setSelectedRecipe("all");
                  setSelectedShootType("all");
                  setSelectedTag("all");
                  setDateRange({ from: undefined, to: undefined });
                }}
              >
                Clear Filters
              </Button>
            )}
          </div>
        </div>

        {filteredPhotos.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-lg">
              {photos.length === 0 ? "No photos yet. Start uploading!" : "No photos match the selected filters."}
            </p>
          </div>
        ) : viewMode === "masonry" ? (
          <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4">
            {filteredPhotos.map(photo => (
              <div key={photo.id} className="break-inside-avoid mb-4">
                <LazyPhotoCard
                  photo={photo}
                  selectionMode={selectionMode}
                  isSelected={selectedPhotos.has(photo.id)}
                  onSelectionChange={handleSelectionChange}
                  initialLikeCount={likeCounts[photo.id] || 0}
                  initialLiked={userLikes.has(photo.id)}
                />
              </div>
            ))}
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPhotos.map(photo => (
                <LazyPhotoCard
                  key={photo.id}
                  photo={photo}
                  selectionMode={selectionMode}
                  isSelected={selectedPhotos.has(photo.id)}
                  onSelectionChange={handleSelectionChange}
                  initialLikeCount={likeCounts[photo.id] || 0}
                  initialLiked={userLikes.has(photo.id)}
                />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredPhotos.map(photo => (
              <LazyPhotoCard
                key={photo.id}
                photo={photo}
                selectionMode={selectionMode}
                isSelected={selectedPhotos.has(photo.id)}
                onSelectionChange={handleSelectionChange}
                initialLikeCount={likeCounts[photo.id] || 0}
                initialLiked={userLikes.has(photo.id)}
                viewMode="list"
              />
            ))}
          </div>
        )}
        
        <div className="mt-16 pb-8 flex justify-center">
          <img src={footerLogo} alt="Film Chronicles" className="h-16 opacity-80" />
        </div>
      </div>
    </div>
  );
};

export default Gallery;
