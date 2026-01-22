using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DogTrials.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddEntriesEntity : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Users",
                columns: table => new
                {
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ExternalSubject = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    Email = table.Column<string>(type: "nvarchar(320)", maxLength: 320, nullable: false),
                    Role = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "SYSUTCDATETIME()"),
                    LastLoginAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Users", x => x.UserId);
                });

            migrationBuilder.CreateTable(
                name: "Entries",
                columns: table => new
                {
                    EntryId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TrialId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedByUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false, defaultValue: "Draft"),
                    SequenceNumber = table.Column<int>(type: "int", nullable: true),
                    RegistrationOrTrackingNumber = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    SubmittedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    DogBreed = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    DogRegisteredName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    DogCallName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    DogDob = table.Column<DateOnly>(type: "date", nullable: true),
                    DogColor = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    DogSex = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: true),
                    DogSire = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    DogDam = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    DogBreeders = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    ContactOwners = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    ContactStreet = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    ContactCity = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    ContactState = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: true),
                    ContactZip = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    ContactEmail = table.Column<string>(type: "nvarchar(320)", maxLength: 320, nullable: true),
                    ContactPhone = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: true),
                    ContactHandler = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    ContactMembershipNumber = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    JuniorDob = table.Column<DateOnly>(type: "date", nullable: true),
                    JuniorMemberId = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    EmergencyName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    EmergencyPhone = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: true),
                    TotalEntryFees = table.Column<decimal>(type: "decimal(10,2)", nullable: true),
                    FeesCurrency = table.Column<string>(type: "nvarchar(3)", maxLength: 3, nullable: true),
                    SelectionsJson = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    TermsVersion = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: true),
                    TermsAcceptedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TermsAcceptedByUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    PdfStatus = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false, defaultValue: "Queued"),
                    GeneratedPdfBlobUri = table.Column<string>(type: "nvarchar(2048)", maxLength: 2048, nullable: true),
                    PdfAttemptCount = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    PdfNextAttemptAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    PdfLastAttemptAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    PdfLastErrorCode = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "SYSUTCDATETIME()"),
                    UpdatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Entries", x => x.EntryId);
                    table.CheckConstraint("CK_Entries_SequenceNumber_Positive", "[SequenceNumber] IS NULL OR [SequenceNumber] >= 1");
                    table.ForeignKey(
                        name: "FK_Entries_Trials_TrialId",
                        column: x => x.TrialId,
                        principalTable: "Trials",
                        principalColumn: "TrialId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Entries_Users_CreatedByUserId",
                        column: x => x.CreatedByUserId,
                        principalTable: "Users",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Entries_CreatedByUserId",
                table: "Entries",
                column: "CreatedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Entries_Status_PdfStatus_PdfNextAttemptAtUtc",
                table: "Entries",
                columns: new[] { "Status", "PdfStatus", "PdfNextAttemptAtUtc" });

            migrationBuilder.CreateIndex(
                name: "UX_Entries_RegistrationOrTrackingNumber",
                table: "Entries",
                column: "RegistrationOrTrackingNumber",
                unique: true,
                filter: "[RegistrationOrTrackingNumber] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "UX_Entries_TrialId_CreatedByUserId_Draft",
                table: "Entries",
                columns: new[] { "TrialId", "CreatedByUserId" },
                unique: true,
                filter: "[Status] = 'Draft'");

            migrationBuilder.CreateIndex(
                name: "UX_Entries_TrialId_SequenceNumber",
                table: "Entries",
                columns: new[] { "TrialId", "SequenceNumber" },
                unique: true,
                filter: "[SequenceNumber] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Users_Email",
                table: "Users",
                column: "Email");

            migrationBuilder.CreateIndex(
                name: "UX_Users_ExternalSubject",
                table: "Users",
                column: "ExternalSubject",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Entries");

            migrationBuilder.DropTable(
                name: "Users");
        }
    }
}
