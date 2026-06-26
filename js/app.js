// js/app.js

document.addEventListener('DOMContentLoaded', () => {
    // Fallback to whichever global assignment finished initializing first
    const supabase = window.supabaseClientInstance || window.supabase;
    
    const adminLoginBtn = document.getElementById('admin-login-btn');
    const adminLogoutBtn = document.getElementById('admin-logout-btn');
    const adminInstructions = document.getElementById('admin-instructions');
    const tripModal = document.getElementById('trip-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    
    const adminFormFields = document.getElementById('admin-form-fields');
    const publicTripDetails = document.getElementById('public-trip-details');
    const friendClaimSection = document.getElementById('friend-claim-section');
    const modalAdminActions = document.getElementById('modal-admin-actions');
    const neighborAlert = document.getElementById('neighbor-alert');
    const neighborDateFields = document.getElementById('neighbor-date-fields');
    
    const tripTitleInput = document.getElementById('trip-title');
    const tripStartDateInput = document.getElementById('trip-start-date');
    const tripEndDateInput = document.getElementById('trip-end-date');
    const tripStartTimeInput = document.getElementById('trip-start-time');
    const tripEndTimeInput = document.getElementById('trip-end-time');
    const includeNeighborsInput = document.getElementById('include-neighbors');
    const neighborStartDateInput = document.getElementById('neighbor-start-date');
    const neighborEndDateInput = document.getElementById('neighbor-end-date');
    
    const claimStartDateInput = document.getElementById('claim-start-date');
    const claimEndDateInput = document.getElementById('claim-end-date');
    const friendNameInput = document.getElementById('friend-name');
    
    const adminSaveBtn = document.getElementById('admin-save-btn');
    const friendClaimBtn = document.getElementById('friend-claim-btn');
    const deleteTripBtn = document.getElementById('delete-trip-btn');
    const tripNotesInput = document.getElementById('trip-notes');
    
    let activeTripData = null;

    if (!supabase) {
        console.error("Supabase instance was missing during app.js initialization step.");
        return;
    }

    includeNeighborsInput.addEventListener('change', () => {
        if (includeNeighborsInput.checked) {
            neighborDateFields.style.display = 'block';
            if (!neighborStartDateInput.value) neighborStartDateInput.value = tripStartDateInput.value;
            if (!neighborEndDateInput.value) neighborEndDateInput.value = tripEndDateInput.value;
        } else {
            neighborDateFields.style.display = 'none';
        }
    });

    async function updateSidebarNeedsCoverList() {
        const listUncovered = document.getElementById('list-uncovered');
        const listPartial = document.getElementById('list-partial');
        const listCovered = document.getElementById('list-covered');
        if (!listUncovered || !listPartial || !listCovered) return;

        const { data: trips, error } = await supabase.from('trips').select('*').order('start_date', { ascending: true });
        if (error || !trips || trips.length === 0) {
            const emptyText = `<p style="font-size: 0.8rem; color: #94a3b8; margin: 0;">No logs created.</p>`;
            listUncovered.innerHTML = emptyText; listPartial.innerHTML = emptyText; listCovered.innerHTML = emptyText;
            return;
        }

        let uncoveredHtml = '', partialHtml = '', coveredHtml = '';

        trips.forEach(trip => {
            const startFormatted = formatReadableDate(trip.start_date);
            const endFormatted = formatReadableDate(trip.end_date);
            let title = trip.title ? trip.title.trim() : 'Away Block';
            
            if (trip.include_neighbors && trip.neighbor_start_date && trip.neighbor_end_date) {
                title += ` 🏠(+34a: ${formatReadableDate(trip.neighbor_start_date)}-${formatReadableDate(trip.neighbor_end_date)})`;
            } else if (trip.include_neighbors) {
                title += ' 🏠(+34a)';
            }
            
            const dataPackage = encodeURIComponent(JSON.stringify(trip));
            const sTimeDisplay = formatTwelveHour(trip.start_time || '09:00');
            const eTimeDisplay = formatTwelveHour(trip.end_time || '18:00');
            
            let colorStyle = 'background: rgba(229,156,34,0.06); border-left: 4px solid #e59c22;';
            let badgeText = '🚨 Open';
            
            if (trip.status === 'claimed') {
                colorStyle = 'background: rgba(46,161,105,0.06); border-left: 4px solid #2ea169;';
                badgeText = `🐾 ${trip.claimed_by}`;
            } else if (trip.status === 'partial') {
                colorStyle = 'background: rgba(16,115,229,0.06); border-left: 4px solid #1073e5;';
                badgeText = '🟡 Split';
            }

            const itemCard = `
                <div class="sidebar-item" data-package="${dataPackage}" style="${colorStyle} padding: 0.65rem; border-radius: 8px; margin-bottom: 0.5rem; cursor: pointer; font-size: 0.8rem;">
                    <div style="display:flex; justify-content:space-between; font-weight:600;">
                        <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:80%;">${title}</span> <span style="opacity:0.8;">${badgeText}</span>
                    </div>
                    <div style="margin-top:2px; color:#64748b;">${startFormatted} (${sTimeDisplay}) - ${endFormatted} (${eTimeDisplay})</div>
                </div>
            `;
            if (trip.status === 'unclaimed') uncoveredHtml += itemCard;
            else if (trip.status === 'partial') partialHtml += itemCard;
            else if (trip.status === 'claimed') coveredHtml += itemCard;
        });

        listUncovered.innerHTML = uncoveredHtml || `<p style="font-size: 0.8rem; color: #94a3b8; margin: 0;">🎉 Fully filled!</p>`;
        listPartial.innerHTML = partialHtml || `<p style="font-size: 0.8rem; color: #94a3b8; margin: 0;">No active splits.</p>`;
        listCovered.innerHTML = coveredHtml || `<p style="font-size: 0.8rem; color: #94a3b8; margin: 0;">No departures set.</p>`;

        document.querySelectorAll('.sidebar-item').forEach(el => {
            el.addEventListener('click', () => {
                const trip = JSON.parse(decodeURIComponent(el.getAttribute('data-package')));
                document.dispatchEvent(new CustomEvent('openTripModal', {
                    detail: {
                        id: trip.id, start: trip.start_date, end: trip.end_date,
                        extendedProps: { 
                            tripTitle: trip.title, status: trip.status, claimedBy: trip.claimed_by, notes: trip.notes, 
                            rawStartDate: trip.start_date, rawEndDate: trip.end_date, startTime: trip.start_time, endTime: trip.end_time, 
                            includeNeighbors: trip.include_neighbors, neighborStartDate: trip.neighbor_start_date, neighborEndDate: trip.neighbor_end_date 
                        }
                    }
                }));
            });
        });
    }

    function formatReadableDate(dateStr) {
        if (!dateStr) return '';
        return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    function formatTwelveHour(timeString) {
        if(!timeString) return '';
        if(timeString === 'morning') return '9:00 AM';
        if(timeString === 'evening') return '6:00 PM';
        const [hourStr, minStr] = timeString.split(':');
        let hour = parseInt(hourStr, 10);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        hour = hour % 12 || 12;
        return `${hour}:${minStr} ${ampm}`;
    }
    window.refreshSidebarView = updateSidebarNeedsCoverList;

    async function checkAuth() {
        const { data: { session } } = await supabase.auth.getSession();
        adminLoginBtn.style.display = session ? 'none' : 'inline-block';
        adminLogoutBtn.style.display = session ? 'inline-block' : 'none';
        adminInstructions.style.display = session ? 'block' : 'none';
        updateSidebarNeedsCoverList();
        document.dispatchEvent(new CustomEvent('authChange', { detail: { isAdmin: !!session } }));
    }
    checkAuth();

    adminLoginBtn.addEventListener('click', async () => {
        const email = prompt("Admin Email:"); if (!email) return;
        const password = prompt("Password:"); if (!password) return;
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) alert(error.message);
        checkAuth();
    });

    adminLogoutBtn.addEventListener('click', async () => {
        await supabase.auth.signOut(); checkAuth();
    });

    document.addEventListener('openTripModal', async (e) => {
        activeTripData = e.detail;
        let { tripTitle, status, claimedBy, notes, startTime, endTime, includeNeighbors, neighborStartDate, neighborEndDate } = activeTripData.extendedProps;
        const sessionCheck = await supabase.auth.getSession();
        const isAdmin = !!sessionCheck.data.session;

        adminFormFields.style.display = 'none'; publicTripDetails.style.display = 'none';
        friendClaimSection.style.display = 'none'; modalAdminActions.style.display = 'none';
        neighborAlert.style.display = 'none'; neighborDateFields.style.display = 'none';

        if(startTime === 'morning') startTime = '09:00';
        if(startTime === 'evening') startTime = '18:00';
        if(endTime === 'morning') endTime = '09:00';
        if(endTime === 'evening') endTime = '18:00';

        tripTitleInput.value = tripTitle || '';
        tripStartDateInput.value = activeTripData.start;
        tripEndDateInput.value = activeTripData.end;
        tripStartTimeInput.value = startTime || '09:00';
        tripEndTimeInput.value = endTime || '18:00';
        tripNotesInput.value = notes || '';
        
        includeNeighborsInput.checked = !!includeNeighbors;
        neighborStartDateInput.value = neighborStartDate || activeTripData.start;
        neighborEndDateInput.value = neighborEndDate || activeTripData.end;

        if (isAdmin && !!includeNeighbors) neighborDateFields.style.display = 'block';

        claimStartDateInput.value = activeTripData.start;
        claimEndDateInput.value = activeTripData.end;
        claimStartDateInput.min = activeTripData.start; claimStartDateInput.max = activeTripData.end;
        claimEndDateInput.min = activeTripData.start; claimEndDateInput.max = activeTripData.end;
        friendNameInput.value = '';

        if (isAdmin) {
            document.getElementById('modal-title').textContent = activeTripData.id ? "✏️ Edit Trip" : "➕ Add Trip";
            adminFormFields.style.display = 'block';
            if (activeTripData.id) modalAdminActions.style.display = 'block';
        } else {
            document.getElementById('modal-title').textContent = status === 'claimed' ? `🐾 Booked by ${claimedBy}` : "📅 Coverage Manager";
            if (includeNeighbors) {
                document.getElementById('text-neighbor-start').textContent = formatReadableDate(neighborStartDate || activeTripData.start);
                document.getElementById('text-neighbor-end').textContent = formatReadableDate(neighborEndDate || activeTripData.end);
                neighborAlert.style.display = 'block';
            }
            const detailsText = `<strong>Label:</strong> ${tripTitle || 'Away Block'}<br><strong>Range:</strong> ${formatReadableDate(activeTripData.start)} (${formatTwelveHour(startTime)}) to ${formatReadableDate(activeTripData.end)} (${formatTwelveHour(endTime)})<br><strong>Notes:</strong> ${notes || 'None'}`;
            document.getElementById('modal-details-text').innerHTML = detailsText;
            publicTripDetails.style.display = 'block';
            if (status !== 'claimed') friendClaimSection.style.display = 'block';
        }
        tripModal.setAttribute('open', true);
    });

    const closeModal = () => tripModal.removeAttribute('open');
    closeModalBtn.addEventListener('click', (e) => { e.preventDefault(); closeModal(); });

    async function validateDatesClear(start, end, skipId) {
        if (new Date(end) < new Date(start)) { alert("End date cannot occur prior to start date."); return false; }
        const { data: records } = await supabase.from('trips').select('id, start_date, end_date');
        if (!records) return true;
        const isOverlapping = records.some(row => {
            if (skipId && row.id === skipId) return false;
            return (start <= row.end_date && end >= row.start_date);
        });
        if (isOverlapping) { alert("⚠️ Overlap Blocked: Dates conflict with another saved entry."); return false; }
        return true;
    }

    adminSaveBtn.addEventListener('click', async () => {
        const t = tripTitleInput.value.trim(), s = tripStartDateInput.value, e = tripEndDateInput.value, n = tripNotesInput.value.trim();
        const st = tripStartTimeInput.value || '09:00'; const et = tripEndTimeInput.value || '18:00';
        const incN = includeNeighborsInput.checked;
        const ns = incN ? neighborStartDateInput.value : null; const ne = incN ? neighborEndDateInput.value : null;
        
        if (!(await validateDatesClear(s, e, activeTripData.id))) return;

        if (activeTripData.id) {
            await supabase.from('trips').update({ title: t, start_date: s, end_date: e, notes: n, start_time: st, end_time: et, include_neighbors: incN, neighbor_start_date: ns, neighbor_end_date: ne }).eq('id', activeTripData.id);
        } else {
            await supabase.from('trips').insert([{ title: t, start_date: s, end_date: e, notes: n, status: 'unclaimed', start_time: st, end_time: et, include_neighbors: incN, neighbor_start_date: ns, neighbor_end_date: ne }]);
        }
        closeModal(); window.refreshCalendarData();
    });

    deleteTripBtn.addEventListener('click', async () => {
        if (!activeTripData || !activeTripData.id) return;
        if (!confirm("Are you sure you want to delete this trip block?")) return;
        await supabase.from('trips').delete().eq('id', activeTripData.id);
        closeModal(); window.refreshCalendarData();
    });

    friendClaimBtn.addEventListener('click', async () => {
        const name = friendNameInput.value.trim(), cs = claimStartDateInput.value, ce = claimEndDateInput.value;
        if (!name) { alert("Please supply your name."); return; }

        const parentStart = activeTripData.start, parentEnd = activeTripData.end;
        const pProps = activeTripData.extendedProps;

        if (cs === parentStart && ce === parentEnd) {
            await supabase.from('trips').update({ status: 'claimed', claimed_by: name }).eq('id', activeTripData.id);
        } else {
            await supabase.from('trips').delete().eq('id', activeTripData.id);
            if (cs > parentStart) {
                const prevEnd = new Date(new Date(cs + 'T00:00:00').setDate(new Date(cs + 'T00:00:00').getDate() - 1)).toISOString().split('T')[0];
                await supabase.from('trips').insert([{ title: pProps.tripTitle, start_date: parentStart, end_date: prevEnd, status: 'unclaimed', notes: pProps.notes, start_time: pProps.startTime, end_time: '18:00', include_neighbors: pProps.includeNeighbors, neighbor_start_date: pProps.neighborStartDate, neighbor_end_date: pProps.neighborEndDate }]);
            }
            await supabase.from('trips').insert([{ title: pProps.tripTitle, start_date: cs, end_date: ce, status: 'claimed', claimed_by: name, notes: pProps.notes, start_time: '09:00', end_time: '18:00', include_neighbors: pProps.includeNeighbors, neighbor_start_date: pProps.neighborStartDate, neighbor_end_date: pProps.neighborEndDate }]);
            
            if (ce < parentEnd) {
                const nextStart = new Date(new Date(ce + 'T00:00:00').setDate(new Date(ce + 'T00:00:00').getDate() + 1)).toISOString().split('T')[0];
                await supabase.from('trips').insert([{ title: pProps.tripTitle, start_date: nextStart, end_date: parentEnd, status: 'unclaimed', notes: pProps.notes, start_time: '09:00', end_time: pProps.endTime, include_neighbors: pProps.includeNeighbors, neighbor_start_date: pProps.neighborStartDate, neighbor_end_date: pProps.neighborEndDate }]);
            }
        }
        closeModal(); 
        window.refreshCalendarData();
    });
});