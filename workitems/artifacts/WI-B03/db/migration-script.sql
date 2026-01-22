IF OBJECT_ID(N'[__EFMigrationsHistory]') IS NULL
BEGIN
    CREATE TABLE [__EFMigrationsHistory] (
        [MigrationId] nvarchar(150) NOT NULL,
        [ProductVersion] nvarchar(32) NOT NULL,
        CONSTRAINT [PK___EFMigrationsHistory] PRIMARY KEY ([MigrationId])
    );
END;
GO

BEGIN TRANSACTION;
CREATE TABLE [Trials] (
    [TrialId] uniqueidentifier NOT NULL,
    [Name] nvarchar(200) NOT NULL,
    [OrganizationCode] nvarchar(32) NOT NULL,
    [SportCode] nvarchar(32) NOT NULL,
    [FormCode] nvarchar(32) NOT NULL,
    [FormVersion] nvarchar(32) NOT NULL,
    [OrganizerSlug] nvarchar(32) NOT NULL,
    [EventSlug] nvarchar(64) NOT NULL,
    [TrackingSlug] AS [OrganizerSlug] + '-' + [EventSlug] PERSISTED,
    [HostClub] nvarchar(200) NOT NULL,
    [StartDate] date NOT NULL,
    [EndDate] date NOT NULL,
    [Location] nvarchar(200) NULL,
    [SecretaryEmail] nvarchar(320) NOT NULL,
    [IsActive] bit NOT NULL,
    [CreatedAtUtc] datetime2 NOT NULL DEFAULT (SYSUTCDATETIME()),
    [UpdatedAtUtc] datetime2 NULL,
    CONSTRAINT [PK_Trials] PRIMARY KEY ([TrialId])
);

CREATE UNIQUE INDEX [UX_Trials_OrganizerSlug_EventSlug] ON [Trials] ([OrganizerSlug], [EventSlug]);

INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
VALUES (N'20260122135909_InitialTrials', N'10.0.2');

COMMIT;
GO

