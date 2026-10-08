-- Общий плеер: ссылка на трек, альбом или плейлист Яндекс Музыки (или код плеера, из которого берётся адрес).
alter table public.gym_profile add column if not exists music text not null default '';
