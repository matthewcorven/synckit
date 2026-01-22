using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DogTrials.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddTrialCounters : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "TrialCounters",
                columns: table => new
                {
                    TrialId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    NextSequenceNumber = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TrialCounters", x => x.TrialId);
                    table.CheckConstraint("CK_TrialCounters_NextSequenceNumber_Positive", "[NextSequenceNumber] >= 1");
                    table.ForeignKey(
                        name: "FK_TrialCounters_Trials_TrialId",
                        column: x => x.TrialId,
                        principalTable: "Trials",
                        principalColumn: "TrialId",
                        onDelete: ReferentialAction.Cascade);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TrialCounters");
        }
    }
}
