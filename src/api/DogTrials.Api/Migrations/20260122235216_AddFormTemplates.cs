using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DogTrials.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddFormTemplates : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "FormTemplates",
                columns: table => new
                {
                    FormTemplateId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    OrganizationCode = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    SportCode = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    FormCode = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    Version = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    GridConfigJson = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FormTemplates", x => x.FormTemplateId);
                });

            migrationBuilder.CreateIndex(
                name: "UX_FormTemplates_Key",
                table: "FormTemplates",
                columns: new[] { "OrganizationCode", "SportCode", "FormCode", "Version" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FormTemplates");
        }
    }
}
