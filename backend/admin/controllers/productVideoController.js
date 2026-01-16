const ProductVideo = require("../../database/models/ProductVideo");

// @desc    Get all product videos
// @route   GET /api/admin/product-videos
// @access  Private/Admin
const getProductVideos = async (req, res) => {
  try {
    const { category, isActive, search } = req.query;
    const filter = {};

    if (category && category !== 'All') {
      filter.category = category;
    }
    if (isActive !== undefined) {
      filter.isActive = isActive === "true";
    }
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const videos = await ProductVideo.find(filter).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: videos.length,
      data: videos,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Error fetching product videos",
    });
  }
};

// @desc    Get single product video
// @route   GET /api/admin/product-videos/:id
// @access  Private/Admin
const getProductVideo = async (req, res) => {
  try {
    const video = await ProductVideo.findById(req.params.id);

    if (!video) {
      return res.status(404).json({
        success: false,
        message: "Product video not found",
      });
    }

    res.status(200).json({
      success: true,
      data: video,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Error fetching product video",
    });
  }
};

// @desc    Create product video
// @route   POST /api/admin/product-videos
// @access  Private/Admin
const createProductVideo = async (req, res) => {
  try {
    const {
      title,
      category,
      videoUrl,
      thumbnailUrl,
      description,
      duration,
      isActive,
    } = req.body;

    const video = await ProductVideo.create({
      title,
      category,
      videoUrl,
      thumbnailUrl: thumbnailUrl || '',
      description: description || '',
      duration: duration || '',
      isActive: isActive !== undefined ? isActive : true,
    });

    res.status(201).json({
      success: true,
      message: "Product video created successfully",
      data: video,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Error creating product video",
    });
  }
};

// @desc    Update product video
// @route   PUT /api/admin/product-videos/:id
// @access  Private/Admin
const updateProductVideo = async (req, res) => {
  try {
    const {
      title,
      category,
      videoUrl,
      thumbnailUrl,
      description,
      duration,
      isActive,
    } = req.body;

    let video = await ProductVideo.findById(req.params.id);

    if (!video) {
      return res.status(404).json({
        success: false,
        message: "Product video not found",
      });
    }

    // Update fields
    if (title) video.title = title;
    if (category) video.category = category;
    if (videoUrl) video.videoUrl = videoUrl;
    if (thumbnailUrl !== undefined) video.thumbnailUrl = thumbnailUrl;
    if (description !== undefined) video.description = description;
    if (duration !== undefined) video.duration = duration;
    if (isActive !== undefined) video.isActive = isActive;

    await video.save();

    res.status(200).json({
      success: true,
      message: "Product video updated successfully",
      data: video,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Error updating product video",
    });
  }
};

// @desc    Delete product video
// @route   DELETE /api/admin/product-videos/:id
// @access  Private/Admin
const deleteProductVideo = async (req, res) => {
  try {
    const video = await ProductVideo.findById(req.params.id);

    if (!video) {
      return res.status(404).json({
        success: false,
        message: "Product video not found",
      });
    }

    await video.deleteOne();

    res.status(200).json({
      success: true,
      message: "Product video deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Error deleting product video",
    });
  }
};

module.exports = {
  getProductVideos,
  getProductVideo,
  createProductVideo,
  updateProductVideo,
  deleteProductVideo,
};
