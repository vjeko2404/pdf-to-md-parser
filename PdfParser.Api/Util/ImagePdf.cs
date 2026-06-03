using PdfSharp;
using PdfSharp.Drawing;
using PdfSharp.Pdf;

namespace PdfParser.Api.Util;

/// <summary>Builds a multi-page PDF from a list of image bytes (one page per image),
/// each fitted onto an A4 page preserving aspect ratio. Used by the mobile "scan with
/// camera" flow: the phone uploads ordered JPEGs, we stitch them into a PDF and feed it
/// into the normal conversion pipeline.</summary>
public static class ImagePdf
{
    public static byte[] FromImages(IReadOnlyList<byte[]> images)
    {
        using var doc = new PdfDocument();
        foreach (var bytes in images)
        {
            using var ms = new MemoryStream(bytes);
            using var img = XImage.FromStream(ms);

            var page = doc.AddPage();
            page.Size = PageSize.A4;
            if (img.PixelWidth > img.PixelHeight)
                page.Orientation = PageOrientation.Landscape;

            using var gfx = XGraphics.FromPdfPage(page);
            double pw = page.Width.Point;
            double ph = page.Height.Point;
            double imgRatio = (double)img.PixelWidth / img.PixelHeight;
            double pageRatio = pw / ph;

            double w,
                h;
            if (imgRatio > pageRatio)
            {
                w = pw;
                h = pw / imgRatio;
            }
            else
            {
                h = ph;
                w = ph * imgRatio;
            }
            // Center the image on the page.
            gfx.DrawImage(img, (pw - w) / 2, (ph - h) / 2, w, h);
        }

        using var outMs = new MemoryStream();
        doc.Save(outMs);
        return outMs.ToArray();
    }
}
