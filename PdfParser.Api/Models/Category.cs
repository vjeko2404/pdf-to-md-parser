namespace PdfParser.Api.Models;

public class Category
{
    public long Id { get; set; }
    public string Name { get; set; } = "";
    public string? Color { get; set; }
    public DateTime CreatedAt { get; set; }
}

/// <summary>Category plus how many documents are assigned to it.</summary>
public class CategoryWithCount : Category
{
    public int Count { get; set; }
}
