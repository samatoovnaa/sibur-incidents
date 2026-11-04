/* ================================================================
   db.js — IndexedDB для сайта СИБУР
   Схема:
     users        (key: email)      — сотрудники
     incidents    (key: id)         — инциденты
     tasks        (key: id)         — задачи (в работе / решены)
     comments     (auto)            — комментарии к инцидентам
     activity     (auto)            — логи действий
     notifications(auto)            — уведомления
     settings     (key)             — настройки, last_user, миграция
   ================================================================ */

const DB_NAME = 'sibur_security_db';
const DB_VERSION = 1;

const DEFAULT_USERS = [
    { name: 'Хасаншина Лейсан', email: 'khasanshina447@gmail.com', position: 'Руководитель отдела ИБ', dob: '2000-01-01', status: 'online', password: '11111', role: 'manager', phone: '+7 (999) 123-45-67', createdAt: Date.now(), updatedAt: Date.now() },
    { name: 'Сафин Инсаф', email: 'safin@sibur.ru', position: 'Аналитик SOC', dob: '1995-05-15', status: 'offline', password: '22222', role: 'analyst', phone: '', createdAt: Date.now(), updatedAt: Date.now() }
];

const DEFAULT_INCIDENTS = [
    { id: 'INC-2841', title: 'Подозрительная активность привилегированной учётной записи', severity: 'Критический', source: 'SIEM', description: 'Обнаружена аномальная активность привилегированной учётной записи. Зафиксированы множественные обращения к критичным ресурсам с нетипичного IP-адреса.', status: 'new', assignedTo: null },
    { id: 'INC-2839', title: 'Выгрузка конфиденциальных документов', severity: 'Высокий', source: 'DLP', description: 'Зафиксирована попытка массовой выгрузки документов, содержащих конфиденциальную информацию.', status: 'new', assignedTo: null },
    { id: 'INC-2836', title: 'Аномалия сетевого трафика АСУ ТП', severity: 'Средний', source: 'SCADA', description: 'Отклонение параметров сетевого трафика АСУ ТП от базовой линии.', status: 'new', assignedTo: null },
    { id: 'INC-2848', title: 'Попытка несанкционированного доступа к БД', severity: 'Критический', source: 'SIEM', description: 'Множественные попытки несанкционированного доступа к базе данных с внешнего IP.', status: 'new', assignedTo: null },
    { id: 'INC-2827', title: 'Устаревшая версия агента защиты', severity: 'Низкий', source: 'EDR', description: 'Агент защиты на нескольких хостах не обновлялся более 30 дней.', status: 'new', assignedTo: null },
    { id: 'INC-2850', title: 'Множественные неудачные попытки входа', severity: 'Высокий', source: 'SIEM', description: 'Более 100 неудачных попыток входа за 5 минут с одного IP-адреса.', status: 'new', assignedTo: null },
    { id: 'INC-2861', title: 'Передача данных на внешний FTP-сервер', severity: 'Средний', source: 'DLP', description: 'Передача файлов на внешний FTP-сервер, не входящий в белый список.', status: 'new', assignedTo: null },
    { id: 'INC-2868', title: 'Утечка базы данных клиентов', severity: 'Критический', source: 'DLP', description: 'Зафиксирована утечка базы данных клиентов. Требуется немедленное реагирование.', status: 'new', assignedTo: null },
    { id: 'INC-2870', title: 'Отклонение в работе промышленного контроллера', severity: 'Высокий', source: 'SCADA', description: 'Отклонение в работе промышленного контроллера.', status: 'new', assignedTo: null },
    { id: 'INC-2855', title: 'Обнаружен потенциально нежелательный файл', severity: 'Низкий', source: 'EDR', description: 'Обнаружен потенциально нежелательный файл на рабочей станции сотрудника.', status: 'new', assignedTo: null },
    { id: 'INC-2881', title: 'Аномальный DNS-трафик на неавторизованные ресурсы', severity: 'Средний', source: 'SIEM', description: 'Аномальный DNS-трафик на неавторизованные ресурсы.', status: 'new', assignedTo: null },
    { id: 'INC-2875', title: 'Отправка конфиденциальных файлов в мессенджер', severity: 'Высокий', source: 'DLP', description: 'Отправка конфиденциальных файлов через мессенджер.', status: 'new', assignedTo: null },
    { id: 'INC-2872', title: 'Обнаружены признаки шифрования файлов (Ransomware)', severity: 'Критический', source: 'SIEM', description: 'Обнаружены признаки шифрования файлов. Высокий риск ransomware-атаки.', status: 'new', assignedTo: null },
    { id: 'INC-2864', title: 'Антивирусные базы не обновлялись 7 дней', severity: 'Низкий', source: 'EDR', description: 'Антивирусные базы не обновлялись 7 дней.', status: 'new', assignedTo: null },
    { id: 'INC-2853', title: 'Попытка несанкционированного подключения к АСУ ТП', severity: 'Высокий', source: 'SCADA', description: 'Попытка несанкционированного подключения к АСУ ТП.', status: 'new', assignedTo: null }
];

const DB = {
    db: null,
    ready: false,

    async open() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, DB_VERSION);

            req.onupgradeneeded = (e) => {
                const db = e.target.result;

                if (!db.objectStoreNames.contains('users')) {
                    const s = db.createObjectStore('users', { keyPath: 'email' });
                    s.createIndex('role', 'role');
                }
                if (!db.objectStoreNames.contains('incidents')) {
                    const s = db.createObjectStore('incidents', { keyPath: 'id' });
                    s.createIndex('severity', 'severity');
                    s.createIndex('status', 'status');
                }
                if (!db.objectStoreNames.contains('tasks')) {
                    db.createObjectStore('tasks', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('comments')) {
                    const s = db.createObjectStore('comments', { keyPath: 'id', autoIncrement: true });
                    s.createIndex('incidentId', 'incidentId');
                }
                if (!db.objectStoreNames.contains('activity')) {
                    const s = db.createObjectStore('activity', { keyPath: 'id', autoIncrement: true });
                    s.createIndex('timestamp', 'timestamp');
                }
                if (!db.objectStoreNames.contains('notifications')) {
                    db.createObjectStore('notifications', { keyPath: 'id', autoIncrement: true });
                }
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                }
            };

            req.onsuccess = (e) => { this.db = e.target.result; this.ready = true; resolve(this.db); };
            req.onerror = (e) => reject(e.target.error);
        });
    },

    _store(store, mode = 'readonly') {
        return this.db.transaction(store, mode).objectStore(store);
    },

    getAll(store) {
        return new Promise((res, rej) => {
            const r = this._store(store).getAll();
            r.onsuccess = () => res(r.result || []);
            r.onerror = () => rej(r.error);
        });
    },

    get(store, key) {
        return new Promise((res, rej) => {
            const r = this._store(store).get(key);
            r.onsuccess = () => res(r.result);
            r.onerror = () => rej(r.error);
        });
    },

    put(store, value) {
        return new Promise((res, rej) => {
            const r = this._store(store, 'readwrite').put(value);
            r.onsuccess = () => res(r.result);
            r.onerror = () => rej(r.error);
        });
    },

    delete(store, key) {
        return new Promise((res, rej) => {
            const r = this._store(store, 'readwrite').delete(key);
            r.onsuccess = () => res();
            r.onerror = () => rej(r.error);
        });
    },

    clear(store) {
        return new Promise((res, rej) => {
            const r = this._store(store, 'readwrite').clear();
            r.onsuccess = () => res();
            r.onerror = () => rej(r.error);
        });
    },

    bulkPut(store, items) {
        return new Promise((res, rej) => {
            const tx = this.db.transaction(store, 'readwrite');
            const s = tx.objectStore(store);
            items.forEach(item => s.put(item));
            tx.oncomplete = () => res();
            tx.onerror = () => rej(tx.error);
        });
    },

    bulkDelete(store, keys) {
        return new Promise((res, rej) => {
            const tx = this.db.transaction(store, 'readwrite');
            const s = tx.objectStore(store);
            keys.forEach(k => s.delete(k));
            tx.oncomplete = () => res();
            tx.onerror = () => rej(tx.error);
        });
    },

    /* ============ Инициализация + миграция + сидинг ============ */
    async init() {
        await this.open();
        await this._migrate();
        await this._seed();
    },

    async _migrate() {
        const flag = await this.get('settings', 'migrated_from_localstorage');
        if (flag) return;

        console.log('🔄 Миграция localStorage → IndexedDB…');

        const oldUsers = JSON.parse(localStorage.getItem('sibur_team') || 'null');
        if (oldUsers && oldUsers.length) {
            await this.bulkPut('users', oldUsers.map(u => ({
                ...u,
                phone: u.phone || '',
                createdAt: u.createdAt || Date.now(),
                updatedAt: Date.now()
            })));
        }

        const oldTasks = JSON.parse(localStorage.getItem('sibur_myTasks') || '[]');
        const oldResolved = JSON.parse(localStorage.getItem('sibur_resolvedTasks') || '[]');
        if (oldTasks.length) await this.bulkPut('tasks', oldTasks.map(t => ({ ...t, status: 'in_progress', createdAt: Date.now() })));
        if (oldResolved.length) await this.bulkPut('tasks', oldResolved.map(t => ({ ...t, status: 'resolved', createdAt: Date.now(), resolvedAt: Date.now() })));

        const oldDescs = JSON.parse(localStorage.getItem('sibur_incidentDescriptions') || '{}');
        const incidents = DEFAULT_INCIDENTS.map(i => ({
            ...i,
            description: oldDescs[i.id] || i.description,
            createdAt: Date.now(),
            updatedAt: Date.now()
        }));
        await this.bulkPut('incidents', incidents);

        const oldActivity = JSON.parse(localStorage.getItem('sibur_userActivity') || '{}');
        for (const email of Object.keys(oldActivity)) {
            const user = (oldUsers || DEFAULT_USERS).find(u => u.email === email);
            for (const log of oldActivity[email]) {
                await this.put('activity', {
                    userEmail: email,
                    userName: user ? user.name : email,
                    text: log.text,
                    type: log.type || 'blue',
                    timestamp: log.timestamp || Date.now()
                });
            }
        }

        const oldCurrentUser = JSON.parse(localStorage.getItem('sibur_currentUser') || 'null');
        if (oldCurrentUser) await this.put('settings', { key: 'last_user', value: oldCurrentUser });

        await this.put('settings', { key: 'migrated_from_localstorage', value: true });
        console.log('✅ Миграция завершена');
    },

    async _seed() {
        const users = await this.getAll('users');
        if (!users.length) await this.bulkPut('users', DEFAULT_USERS);

        const incidents = await this.getAll('incidents');
        if (!incidents.length) {
            await this.bulkPut('incidents', DEFAULT_INCIDENTS.map(i => ({ ...i, createdAt: Date.now(), updatedAt: Date.now() })));
        }
    },

    /* ============ Полная очистка (для отладки) ============ */
    async reset() {
        await indexedDB.deleteDatabase(DB_NAME);
        localStorage.clear();
        location.reload();
    }
};

window.DB = DB;
window.DEFAULT_USERS = DEFAULT_USERS;
window.DEFAULT_INCIDENTS = DEFAULT_INCIDENTS;
