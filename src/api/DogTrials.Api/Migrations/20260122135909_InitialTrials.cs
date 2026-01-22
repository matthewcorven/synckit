using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DogTrials.Api.Migrations
{
    /// <inheritdoc />
    public partial class InitialTrials : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Trials",
                columns: table => new
                {
                    TrialId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    OrganizationCode = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    SportCode = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    FormCode = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    FormVersion = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    OrganizerSlug = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    EventSlug = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    TrackingSlug = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false, computedColumnSql: "[OrganizerSlug] + '-' + [EventSlug]", stored: true),
                    HostClub = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    StartDate = table.Column<DateOnly>(type: "date", nullable: false),
                    EndDate = table.Column<DateOnly>(type: "date", nullable: false),
                    Location = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    SecretaryEmail = table.Column<string>(type: "nvarchar(320)", maxLength: 320, nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "SYSUTCDATETIME()"),
                    UpdatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Trials", x => x.TrialId);
                });

            migrationBuilder.CreateIndex(
                name: "UX_Trials_OrganizerSlug_EventSlug",
                table: "Trials",
                columns: new[] { "OrganizerSlug", "EventSlug" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Trials");
        }
    }
}
