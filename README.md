# Pineapple Dataset

This repository documents a cleaned single-class pineapple oriented object detection dataset.

The image and label files are not committed directly to this repository because the cleaned dataset is about 6.4 GB. Host the dataset on Google Drive or another file host, then place the public download link in the section below.

## Download

Google Drive: **link to be added**

Local cleaned dataset prepared at:

```text
/Volumes/Elements/pineapple_dataset_upload_flat
```

## Dataset Structure

The downloadable dataset folder should contain only two directories:

```text
image/
label/
```

Each image has one label file with the same stem:

```text
image/000001.jpg
label/000001.txt
```

## Dataset Summary

- Task: pineapple detection / localization
- Annotation type: oriented bounding box / quadrilateral
- Classes: 1
- Class name: `pineapple`
- Class id: `0`
- Images: 775 JPG files
- Label files: 775 TXT files
- Annotated pineapple instances: 13,041

This dataset does not include quality, ripeness, grading, disease, or harvestability labels.

## Label Format

Labels use a normalized YOLO-style oriented box format:

```text
class x1 y1 x2 y2 x3 y3 x4 y4
```

Example:

```text
0 0.100909 0.0391677 0.158943 0.0461036 0.148549 0.123623 0.0905154 0.116687
```

All coordinates are normalized to the image width and height. The only valid class id is `0`.

## Notes

The cleaned local version contains no cache files, README files, YAML files, ZIP files, or extra metadata folders. The JPG images were cleaned with lossless JPEG metadata stripping, and label files were normalized to LF line endings.
