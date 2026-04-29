-- Create 10 sample notifications
INSERT INTO notifications (code, title, content, source, source_detail, notification_date, status, created_by) VALUES 
('MSI 001/26', 'Navigationele waarschuwing - Haven Antwerpen', 'Tijdelijke obstructie in het vaarwater nabij boei A12. Verminderde diepgang tot 8.5m.', 'API', 'MRCC', CURRENT_DATE, 'pending', 4),
('MSI 002/26', 'Baggerwerken Schelde', 'Baggerwerken tussen km 80 en km 85 van de Schelde. Verwachte duur 3 weken.', 'Mail', 'Waterwegen', CURRENT_DATE - 1, 'pending', 4),
('BASS 001/26', 'Defecte boei Zeebrugge', 'Kardinale boei Z3 buiten werking. Vervanging gepland voor volgende week.', 'API', 'BASS', CURRENT_DATE, 'pending', 4),
('MSI 003/26', 'Nieuwe kabel op zeebodem', 'Installatie van onderzeese kabel tussen Nederland en UK. Positie opgenomen in chart.', 'Manual', 'Manual Entry', CURRENT_DATE - 2, 'processed', 4),
('MSI 004/26', 'Wrakverwijdering Noordzee', 'Wrak op positie 51°20''N 3°15''E wordt verwijderd. Gebied afgezet.', 'API', 'MRCC', CURRENT_DATE, 'pending', 4),
('POAB 012/26', 'Nieuw steiger Port of Antwerp', 'Nieuwe aanlegsteiger operationeel in dok 7. Coördinaten bijgewerkt.', 'API', 'POAB', CURRENT_DATE - 1, 'pending', 4),
('MSI 005/26', 'Defect licht toren Westerschelde', 'Licht op toren WS8 tijdelijk buiten dienst. Herstel binnen 48u verwacht.', 'Mail', 'Kust', CURRENT_DATE, 'pending', 4),
('BASS 002/26', 'Verplaatsing drijvende installatie', 'Olieplatform verplaatst naar nieuwe positie. Update vereist voor chart NL34.', 'API', 'BASS', CURRENT_DATE, 'pending', 4),
('MSI 006/26', 'Tijdelijk verboden gebied', 'Militaire oefening in gebied 51°30''N tot 51°45''N. Geldig tot einde maand.', 'API', 'MRCC', CURRENT_DATE - 3, 'processed', 4),
('FLARIS 001/26', 'Update binnenvaart route', 'Wijziging in aanbevolen route Albert Kanaal. Nieuwe markering geplaatst.', 'API', 'FLARIS', CURRENT_DATE, 'pending', 4);
